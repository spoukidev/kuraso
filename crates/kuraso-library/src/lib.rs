//! Kuraso file-based library management (files are the source of truth).
//!
//! Layout inside `<Library>` (safe to sync with Dropbox, OneDrive, Syncthing):
//! - `kuraso-library.json`
//! - `collections.json`
//! - `papers/<slug>/paper.pdf`
//! - `papers/<slug>/meta.json`
//! - `papers/<slug>/notes.md`
//!
//! All writes are atomic (write sibling temp file, then rename).

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

pub const LIBRARY_MARKER_FILE: &str = "kuraso-library.json";
pub const COLLECTIONS_FILE: &str = "collections.json";
pub const PAPERS_DIR: &str = "papers";
pub const FORMAT_VERSION: &str = "1.0.0";

#[derive(Debug, Error)]
pub enum LibraryError {
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Duplicate paper already exists (id={existing_id}, reason={reason})")]
    Duplicate { existing_id: String, reason: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LibraryMarker {
    pub library_id: String,
    pub format_version: String,
    pub name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    pub name: String,
    pub orcid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReadingPosition {
    pub page: u32,
    pub scroll_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PaperMeta {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub authors: Vec<Author>,
    pub year: Option<i32>,
    pub venue: Option<String>,
    pub doi: Option<String>,
    pub arxiv_id: Option<String>,
    pub url: Option<String>,
    pub r#abstract: Option<String>,
    pub language: Option<String>,
    pub page_count: Option<u32>,
    pub file_hash: String,
    pub scanned: bool,
    pub status: String,
    pub tags: Vec<String>,
    pub reading_position: Option<ReadingPosition>,
    pub added_at: String,
    pub updated_at: String,
    pub read_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    #[serde(default)]
    pub local_ai_only: bool,
    pub paper_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CollectionsFile {
    pub version: u32,
    pub collections: Vec<Collection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SyncConflict {
    pub relative_path: String,
    pub file_name: String,
}

/// Atomically writes bytes to `target` by writing a sibling temp file and renaming.
pub fn write_atomic(target: &Path, bytes: &[u8]) -> io::Result<()> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    let file_name = target
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("kuraso");
    let tmp_path = target.with_file_name(format!(".{file_name}.tmp"));
    fs::write(&tmp_path, bytes)?;
    fs::rename(&tmp_path, target)?;
    Ok(())
}

/// Compute `sha256:<64-hex>` hash for PDF duplicate detection.
pub fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    let mut hex = String::with_capacity(7 + digest.len() * 2);
    hex.push_str("sha256:");
    for b in digest {
        use std::fmt::Write as _;
        let _ = write!(&mut hex, "{b:02x}");
    }
    hex
}

fn unix_timestamp_iso_like() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}Z")
}

/// Generate a clean filesystem-safe slug (`<year>-<title>-<hash6>`).
pub fn make_slug(year: Option<i32>, title: &str, file_hash: &str) -> String {
    let year_part = year
        .map(|y| y.to_string())
        .unwrap_or_else(|| "undated".to_string());
    let words: Vec<String> = title
        .to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|w| w.len() > 2)
        .take(3)
        .map(String::from)
        .collect();
    let title_part = if words.is_empty() {
        "paper".to_string()
    } else {
        words.join("-")
    };
    let hash_part = file_hash
        .strip_prefix("sha256:")
        .unwrap_or(file_hash)
        .chars()
        .take(6)
        .collect::<String>();
    format!("{year_part}-{title_part}-{hash_part}")
}

#[derive(Debug, Clone)]
pub struct Library {
    root: PathBuf,
}

impl Library {
    pub fn open_or_init(root: PathBuf) -> Result<Self, LibraryError> {
        fs::create_dir_all(root.join(PAPERS_DIR))?;
        let marker_path = root.join(LIBRARY_MARKER_FILE);
        if !marker_path.exists() {
            let now = unix_timestamp_iso_like();
            let marker = LibraryMarker {
                library_id: format!("lib_{}", &hash_bytes(now.as_bytes())[7..19]),
                format_version: FORMAT_VERSION.to_string(),
                name: Some("Kuraso Library".to_string()),
                created_at: now,
            };
            write_atomic(&marker_path, &serde_json::to_vec_pretty(&marker)?)?;
        }
        let collections_path = root.join(COLLECTIONS_FILE);
        if !collections_path.exists() {
            let empty = CollectionsFile {
                version: 1,
                collections: Vec::new(),
            };
            write_atomic(&collections_path, &serde_json::to_vec_pretty(&empty)?)?;
        }
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn list_papers(&self) -> Result<Vec<PaperMeta>, LibraryError> {
        let papers_dir = self.root.join(PAPERS_DIR);
        if !papers_dir.exists() {
            return Ok(Vec::new());
        }
        let mut results = Vec::new();
        for entry in fs::read_dir(papers_dir)? {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                let meta_path = entry.path().join("meta.json");
                if meta_path.is_file() {
                    let raw = fs::read_to_string(&meta_path)?;
                    if let Ok(meta) = serde_json::from_str::<PaperMeta>(&raw) {
                        results.push(meta);
                    }
                }
            }
        }
        results.sort_by(|a, b| b.added_at.cmp(&a.added_at));
        Ok(results)
    }

    /// Folder of one paper. Slugs come from callers (including the webview), so anything
    /// that could leave the papers folder ("..", separators, drive prefixes) is rejected.
    fn paper_dir(&self, slug: &str) -> Result<PathBuf, LibraryError> {
        let ok = !slug.is_empty()
            && slug.len() <= 200
            && slug != "."
            && slug != ".."
            && slug
                .chars()
                .all(|c| c.is_alphanumeric() || matches!(c, '-' | '_' | '.'))
            && !slug.starts_with('.');
        if ok {
            Ok(self.root.join(PAPERS_DIR).join(slug))
        } else {
            Err(LibraryError::Io(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("invalid paper slug: {slug:?}"),
            )))
        }
    }

    pub fn read_paper_notes(&self, slug: &str) -> Result<String, LibraryError> {
        let notes_path = self.paper_dir(slug)?.join("notes.md");
        if notes_path.is_file() {
            Ok(fs::read_to_string(notes_path)?)
        } else {
            Ok(String::new())
        }
    }

    pub fn save_paper_notes(&self, slug: &str, markdown: &str) -> Result<(), LibraryError> {
        let notes_path = self.paper_dir(slug)?.join("notes.md");
        write_atomic(&notes_path, markdown.as_bytes())?;
        Ok(())
    }

    pub fn load_annotations_raw(&self, slug: &str) -> Result<Option<String>, LibraryError> {
        let path = self.paper_dir(slug)?.join("annotations.json");
        if path.is_file() {
            Ok(Some(fs::read_to_string(path)?))
        } else {
            Ok(None)
        }
    }

    pub fn save_annotations_raw(&self, slug: &str, json: &str) -> Result<(), LibraryError> {
        let path = self.paper_dir(slug)?.join("annotations.json");
        write_atomic(&path, json.as_bytes())?;
        Ok(())
    }

    pub fn load_structure_raw(&self, slug: &str) -> Result<Option<String>, LibraryError> {
        let path = self.paper_dir(slug)?.join("structure.json");
        if path.is_file() {
            Ok(Some(fs::read_to_string(path)?))
        } else {
            Ok(None)
        }
    }

    /// Save `structure.json` atomically; if an existing version exists and `backup_version` is given,
    /// preserve it as `structure.v<N>.bak.json` before writing so re-parses are never destructive.
    pub fn save_structure_raw(
        &self,
        slug: &str,
        json: &str,
        backup_version: Option<u32>,
    ) -> Result<(), LibraryError> {
        let dir = self.paper_dir(slug)?;
        let path = dir.join("structure.json");
        if path.is_file() {
            if let Some(prev_ver) = backup_version {
                let bak = dir.join(format!("structure.v{prev_ver}.bak.json"));
                let _ = fs::copy(&path, &bak);
            }
        }
        write_atomic(&path, json.as_bytes())?;
        Ok(())
    }

    pub fn import_pdf_bytes(
        &self,
        title: &str,
        pdf_bytes: &[u8],
        year: Option<i32>,
        doi: Option<String>,
    ) -> Result<PaperMeta, LibraryError> {
        let file_hash = hash_bytes(pdf_bytes);
        let existing = self.list_papers()?;
        for paper in &existing {
            if paper.file_hash == file_hash {
                return Err(LibraryError::Duplicate {
                    existing_id: paper.id.clone(),
                    reason: "identical file hash".to_string(),
                });
            }
            if let (Some(new_doi), Some(old_doi)) = (&doi, &paper.doi) {
                if new_doi.eq_ignore_ascii_case(old_doi) {
                    return Err(LibraryError::Duplicate {
                        existing_id: paper.id.clone(),
                        reason: format!("matching DOI {old_doi}"),
                    });
                }
            }
        }

        let slug = make_slug(year, title, &file_hash);
        let paper_dir = self.root.join(PAPERS_DIR).join(&slug);
        fs::create_dir_all(&paper_dir)?;

        write_atomic(&paper_dir.join("paper.pdf"), pdf_bytes)?;
        let notes_path = paper_dir.join("notes.md");
        if !notes_path.exists() {
            write_atomic(&notes_path, format!("# {title}\n\n").as_bytes())?;
        }

        let now = unix_timestamp_iso_like();
        let meta = PaperMeta {
            id: format!("pap_{}", &file_hash[7..19]),
            slug: slug.clone(),
            title: title.to_string(),
            authors: Vec::new(),
            year,
            venue: None,
            doi,
            arxiv_id: None,
            url: None,
            r#abstract: None,
            language: None,
            page_count: None,
            file_hash,
            scanned: false,
            status: "to-read".to_string(),
            tags: Vec::new(),
            reading_position: None,
            added_at: now.clone(),
            updated_at: now,
            read_at: None,
        };

        write_atomic(
            &paper_dir.join("meta.json"),
            &serde_json::to_vec_pretty(&meta)?,
        )?;
        Ok(meta)
    }

    pub fn save_paper_meta(&self, meta: &PaperMeta) -> Result<(), LibraryError> {
        let meta_path = self
            .root
            .join(PAPERS_DIR)
            .join(&meta.slug)
            .join("meta.json");
        write_atomic(&meta_path, &serde_json::to_vec_pretty(meta)?)?;
        Ok(())
    }

    pub fn load_collections(&self) -> Result<CollectionsFile, LibraryError> {
        let path = self.root.join(COLLECTIONS_FILE);
        if !path.is_file() {
            return Ok(CollectionsFile {
                version: 1,
                collections: Vec::new(),
            });
        }
        let raw = fs::read_to_string(path)?;
        Ok(serde_json::from_str(&raw)?)
    }

    pub fn save_collections(&self, data: &CollectionsFile) -> Result<(), LibraryError> {
        let path = self.root.join(COLLECTIONS_FILE);
        write_atomic(&path, &serde_json::to_vec_pretty(data)?)?;
        Ok(())
    }

    /// Detect cloud sync conflict copies (Dropbox, Syncthing, OneDrive) so the UI can surface them.
    pub fn scan_sync_conflicts(&self) -> Result<Vec<SyncConflict>, LibraryError> {
        let mut conflicts = Vec::new();
        scan_dir_for_conflicts(&self.root, &self.root, &mut conflicts)?;
        Ok(conflicts)
    }
}

fn is_conflict_filename(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("conflicted copy") || lower.contains(".sync-conflict-")
}

fn scan_dir_for_conflicts(root: &Path, dir: &Path, out: &mut Vec<SyncConflict>) -> io::Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if entry.file_type()?.is_dir() {
            scan_dir_for_conflicts(root, &path, out)?;
        } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if is_conflict_filename(name) {
                let rel = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                out.push(SyncConflict {
                    relative_path: rel,
                    file_name: name.to_string(),
                });
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_lib_dir(tag: &str) -> PathBuf {
        let secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("kuraso-test-{tag}-{secs}"))
    }

    #[test]
    fn rejects_slugs_that_escape_the_papers_folder() {
        let dir = temp_lib_dir("slug");
        let lib = Library::open_or_init(dir.clone()).unwrap();
        for bad in ["../evil", "..", "a/b", "a\\b", "", ".hidden", "C:evil"] {
            assert!(lib.save_paper_notes(bad, "x").is_err(), "accepted {bad:?}");
            assert!(lib.load_annotations_raw(bad).is_err(), "accepted {bad:?}");
        }
        assert!(lib
            .save_paper_notes("2017-vaswani-attention-abc123", "# ok")
            .is_ok());
        assert_eq!(
            lib.read_paper_notes("2017-vaswani-attention-abc123")
                .unwrap(),
            "# ok"
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn imports_deduplicates_and_detects_conflicts() {
        let dir = temp_lib_dir("lib");
        let lib = Library::open_or_init(dir.clone()).unwrap();

        let meta = lib
            .import_pdf_bytes(
                "Adversarial IDS",
                b"%PDF-1.7 sample bytes",
                Some(2024),
                Some("10.1109/TEST.2024.1".to_string()),
            )
            .unwrap();
        assert_eq!(meta.status, "to-read");
        assert_eq!(lib.list_papers().unwrap().len(), 1);

        // Duplicate by hash must fail cleanly
        let dup_hash = lib.import_pdf_bytes("Copy", b"%PDF-1.7 sample bytes", Some(2024), None);
        assert!(matches!(dup_hash, Err(LibraryError::Duplicate { .. })));

        // Duplicate by DOI must fail cleanly
        let dup_doi = lib.import_pdf_bytes(
            "Different bytes same DOI",
            b"%PDF-1.7 different bytes",
            Some(2024),
            Some("10.1109/test.2024.1".to_string()),
        );
        assert!(matches!(dup_doi, Err(LibraryError::Duplicate { .. })));

        // Simulate a Dropbox conflict file
        let conflict_file = dir
            .join(PAPERS_DIR)
            .join(&meta.slug)
            .join("notes (conflicted copy).md");
        fs::write(&conflict_file, "conflicting note").unwrap();
        let conflicts = lib.scan_sync_conflicts().unwrap();
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].file_name, "notes (conflicted copy).md");

        let _ = fs::remove_dir_all(dir);
    }
}
