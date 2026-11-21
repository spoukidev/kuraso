//! Kuraso rebuildable local SQLite + FTS5 index.
//!
//! Lives exclusively in local OS app-data (`<OS app-data>/Kuraso/index.sqlite`),
//! never inside the user's synced library folder.

pub const INDEX_DB_FILENAME: &str = "index.sqlite";
pub const INDEX_SCHEMA_VERSION: u32 = 1;
