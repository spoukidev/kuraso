//! Kuraso PDF extraction, heading detection, and paragraph segmentation.
//!
//! All coordinates follow `pdf-cropbox-points-bl-unrotated`:
//! PDF user-space points, unscaled, relative to page CropBox, bottom-left origin,
//! before `/Rotate` is applied: `[x1, y1, x2, y2]` with `x1 < x2` and `y1 < y2`.

use serde::{Deserialize, Serialize};

pub const PARSER_VERSION: u32 = 1;
pub const COORDINATE_SPACE: &str = "pdf-cropbox-points-bl-unrotated";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PdfAnchor {
    pub page: u32,
    pub rect: [f64; 4],
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

/// Format sequential paragraph IDs (`P1`, `P2`, ...).
pub fn paragraph_id(index_one_based: usize) -> String {
    format!("P{index_one_based}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_paragraph_ids() {
        assert_eq!(paragraph_id(1), "P1");
        assert_eq!(paragraph_id(42), "P42");
    }
}
