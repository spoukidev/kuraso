//! Kuraso file-based library management (files are the source of truth).
//!
//! All writes are atomic (write to temporary sibling file, then rename) so
//! cloud sync tools (Dropbox, OneDrive, Syncthing) never observe partial files.

use std::fs;
use std::io;
use std::path::Path;

pub const LIBRARY_MARKER_FILE: &str = "kuraso-library.json";
pub const COLLECTIONS_FILE: &str = "collections.json";
pub const FORMAT_VERSION: &str = "0.1.0";

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
