//! Kuraso rebuildable local SQLite + FTS5 index.
//!
//! Lives exclusively in local OS app-data (`<OS app-data>/Kuraso/index.sqlite`),
//! never inside the user's synced library folder. Deleting `index.sqlite` is
//! always safe and triggers a clean rebuild from the library files.

use kuraso_library::{Library, LibraryError};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use thiserror::Error;

pub const INDEX_DB_FILENAME: &str = "index.sqlite";
pub const INDEX_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Error)]
pub enum IndexError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Library error: {0}")]
    Library(#[from] LibraryError),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub paper_id: String,
    pub slug: String,
    pub title: String,
    pub snippet: String,
    pub rank: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RebuildStats {
    pub papers_indexed: usize,
    pub collections_indexed: usize,
}

pub struct SearchIndex {
    conn: Connection,
}

impl SearchIndex {
    pub fn open(path: &Path) -> Result<Self, IndexError> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS papers (
                id TEXT PRIMARY KEY,
                slug TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                year INTEGER,
                venue TEXT,
                doi TEXT,
                status TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                added_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT,
                local_ai_only INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS paper_collections (
                paper_id TEXT NOT NULL,
                collection_id TEXT NOT NULL,
                PRIMARY KEY (paper_id, collection_id)
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS fts_content USING fts5(
                paper_id UNINDEXED,
                slug UNINDEXED,
                title,
                authors,
                venue,
                tags,
                body
            );
            ",
        )?;
        Ok(Self { conn })
    }

    /// Wipe and rebuild the entire SQLite + FTS5 index directly from the files in `library`.
    pub fn rebuild_from_library(&mut self, library: &Library) -> Result<RebuildStats, IndexError> {
        let papers = library.list_papers()?;
        let collections_file = library.load_collections()?;

        let tx = self.conn.transaction()?;
        tx.execute_batch(
            "
            DELETE FROM paper_collections;
            DELETE FROM collections;
            DELETE FROM papers;
            DELETE FROM fts_content;
            ",
        )?;

        for paper in &papers {
            tx.execute(
                "INSERT INTO papers (id, slug, title, year, venue, doi, status, file_hash, added_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    paper.id,
                    paper.slug,
                    paper.title,
                    paper.year,
                    paper.venue,
                    paper.doi,
                    paper.status,
                    paper.file_hash,
                    paper.added_at,
                ],
            )?;

            let authors_joined = paper
                .authors
                .iter()
                .map(|a| a.name.as_str())
                .collect::<Vec<_>>()
                .join(", ");
            let tags_joined = paper.tags.join(" ");
            let notes = library.read_paper_notes(&paper.slug).unwrap_or_default();
            let mut body = paper.r#abstract.clone().unwrap_or_default();
            if !notes.is_empty() {
                if !body.is_empty() {
                    body.push('\n');
                }
                body.push_str(&notes);
            }

            tx.execute(
                "INSERT INTO fts_content (paper_id, slug, title, authors, venue, tags, body)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    paper.id,
                    paper.slug,
                    paper.title,
                    authors_joined,
                    paper.venue.as_deref().unwrap_or(""),
                    tags_joined,
                    body,
                ],
            )?;
        }

        for col in &collections_file.collections {
            tx.execute(
                "INSERT INTO collections (id, name, parent_id, local_ai_only)
                 VALUES (?1, ?2, ?3, ?4)",
                params![col.id, col.name, col.parent_id, i32::from(col.local_ai_only)],
            )?;
            for paper_id in &col.paper_ids {
                tx.execute(
                    "INSERT OR IGNORE INTO paper_collections (paper_id, collection_id)
                     VALUES (?1, ?2)",
                    params![paper_id, col.id],
                )?;
            }
        }

        tx.commit()?;
        Ok(RebuildStats {
            papers_indexed: papers.len(),
            collections_indexed: collections_file.collections.len(),
        })
    }

    /// Full-text search across titles, authors, venues, tags, abstracts, and notes via FTS5.
    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchHit>, IndexError> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }

        let mut stmt = self.conn.prepare(
            "SELECT paper_id, slug, title,
                    snippet(fts_content, 6, '[', ']', '...', 18) AS snippet,
                    bm25(fts_content) AS rank
             FROM fts_content
             WHERE fts_content MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![trimmed, limit as i64], |row| {
            Ok(SearchHit {
                paper_id: row.get(0)?,
                slug: row.get(1)?,
                title: row.get(2)?,
                snippet: row.get(3)?,
                rank: row.get(4)?,
            })
        })?;

        let mut hits = Vec::new();
        for row in rows {
            hits.push(row?);
        }
        Ok(hits)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn rebuilds_index_from_files_and_searches_with_fts5() {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("kuraso-idx-test-{nanos}"));
        let lib_dir = root.join("library");
        let db_path = root.join("app-data").join(INDEX_DB_FILENAME);

        let lib = Library::open_or_init(lib_dir).unwrap();
        let meta = lib
            .import_pdf_bytes(
                "Federated Intrusion Detection",
                b"%PDF-1.7 test",
                Some(2025),
                None,
            )
            .unwrap();

        let mut idx = SearchIndex::open(&db_path).unwrap();
        let stats = idx.rebuild_from_library(&lib).unwrap();
        assert_eq!(stats.papers_indexed, 1);

        let hits = idx.search("Federated", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].paper_id, meta.id);

        // Delete index.sqlite and prove full rebuild recovers cleanly from files
        drop(idx);
        std::fs::remove_file(&db_path).unwrap();
        let mut rebuilt = SearchIndex::open(&db_path).unwrap();
        let stats2 = rebuilt.rebuild_from_library(&lib).unwrap();
        assert_eq!(stats2.papers_indexed, 1);
        assert_eq!(rebuilt.search("Intrusion", 10).unwrap().len(), 1);

        let _ = std::fs::remove_dir_all(root);
    }
}
