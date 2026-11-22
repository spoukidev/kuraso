//! Kuraso BYOK AI router and programmatic `[P#]` citation verifier.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderKind {
    OpenaiCompatible,
    Anthropic,
    Ollama,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VerifiedCitations {
    pub valid: Vec<String>,
    pub invalid: Vec<String>,
}

/// Extract `[P12]`-style citation tags from text and verify each against known paragraph IDs.
pub fn verify_paragraph_citations(text: &str, valid_ids: &HashSet<String>) -> VerifiedCitations {
    let mut valid = Vec::new();
    let mut invalid = Vec::new();
    let bytes = text.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'[' && i + 2 < bytes.len() && bytes[i + 1] == b'P' {
            let mut j = i + 2;
            while j < bytes.len() && bytes[j].is_ascii_digit() {
                j += 1;
            }
            if j > i + 2 && j < bytes.len() && bytes[j] == b']' {
                let id = &text[i + 1..j];
                if valid_ids.contains(id) {
                    valid.push(id.to_string());
                } else {
                    invalid.push(id.to_string());
                }
                i = j + 1;
                continue;
            }
        }
        i += 1;
    }

    VerifiedCitations { valid, invalid }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_invalid_paragraph_citations() {
        let valid_ids: HashSet<String> =
            ["P1", "P12", "P14"].into_iter().map(String::from).collect();
        let res = verify_paragraph_citations(
            "They evaluated on CIC-IDS2017 [P12] and claimed 99% accuracy [P999] [P14].",
            &valid_ids,
        );
        assert_eq!(res.valid, vec!["P12", "P14"]);
        assert_eq!(res.invalid, vec!["P999"]);
    }
}
