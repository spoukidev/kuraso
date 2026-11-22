//! Kuraso PDF extraction, heading detection, and paragraph segmentation.
//!
//! All coordinates follow `pdf-cropbox-points-bl-unrotated`:
//! PDF user-space points, unscaled, relative to page CropBox, bottom-left origin,
//! before `/Rotate` is applied: `[x1, y1, x2, y2]` with `x1 < x2` and `y1 < y2`.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub const PARSER_VERSION: u32 = 1;
pub const COORDINATE_SPACE: &str = "pdf-cropbox-points-bl-unrotated";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PdfAnchor {
    pub page: u32,
    pub rect: [f64; 4],
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutlineItem {
    pub title: String,
    pub page: u32,
    pub level: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Paragraph {
    pub id: String,
    pub section: String,
    pub text: String,
    pub char_start: usize,
    pub char_end: usize,
    pub anchors: Vec<PdfAnchor>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PdfDocumentInfo {
    pub page_count: u32,
    pub has_text_layer: bool,
    pub outline: Vec<OutlineItem>,
}

/// Platform-specific shared library filename for bundled PDFium.
pub fn pdfium_library_filename() -> &'static str {
    if cfg!(target_os = "windows") {
        "pdfium.dll"
    } else if cfg!(target_os = "macos") {
        "libpdfium.dylib"
    } else {
        "libpdfium.so"
    }
}

/// Locate a bundled PDFium shared library under the given search directories.
pub fn locate_pdfium_library(search_dirs: &[PathBuf]) -> Option<PathBuf> {
    let filename = pdfium_library_filename();
    for dir in search_dirs {
        let direct = dir.join(filename);
        if direct.is_file() {
            return Some(direct);
        }
        let nested_lib = dir.join("lib").join(filename);
        if nested_lib.is_file() {
            return Some(nested_lib);
        }
        let nested_bin = dir.join("bin").join(filename);
        if nested_bin.is_file() {
            return Some(nested_bin);
        }
    }
    None
}

/// Format sequential paragraph IDs (`P1`, `P2`, ...).
pub fn paragraph_id(index_one_based: usize) -> String {
    format!("P{index_one_based}")
}

/// Detect whether a single line looks like an academic section heading.
pub fn detect_heading_level(line: &str) -> Option<u8> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.len() > 90 || trimmed.ends_with('.') || trimmed.ends_with('?') {
        return None;
    }
    let lower = trimmed.to_ascii_lowercase();
    let stripped = lower
        .trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c.is_whitespace());
    const KNOWN: &[&str] = &[
        "abstract",
        "introduction",
        "background",
        "related work",
        "method",
        "methodology",
        "experiments",
        "evaluation",
        "results",
        "discussion",
        "limitations",
        "conclusion",
        "conclusions",
        "references",
    ];
    if KNOWN.contains(&stripped) {
        return Some(1);
    }
    let mut parts = trimmed.split_whitespace();
    if let (Some(prefix), Some(first_word)) = (parts.next(), parts.next()) {
        if first_word.chars().next().is_some_and(|c| c.is_ascii_uppercase()) {
            let clean_prefix = prefix.trim_end_matches('.');
            if !clean_prefix.is_empty()
                && clean_prefix
                    .split('.')
                    .all(|seg| !seg.is_empty() && seg.chars().all(|c| c.is_ascii_digit()))
            {
                let depth = clean_prefix.split('.').count().min(3) as u8;
                return Some(depth);
            }
        }
    }
    None
}

/// Check if a path has a `.pdf` extension (case-insensitive).
pub fn is_pdf_path(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_paragraph_ids() {
        assert_eq!(paragraph_id(1), "P1");
        assert_eq!(paragraph_id(42), "P42");
    }

    #[test]
    fn detects_pdf_extension_case_insensitively() {
        assert!(is_pdf_path(Path::new("paper.pdf")));
        assert!(is_pdf_path(Path::new("PAPER.PDF")));
        assert!(!is_pdf_path(Path::new("notes.md")));
    }

    #[test]
    fn returns_none_when_pdfium_missing() {
        let found = locate_pdfium_library(&[PathBuf::from("/nonexistent/kuraso/pdfium")]);
        assert!(found.is_none());
    }
}
