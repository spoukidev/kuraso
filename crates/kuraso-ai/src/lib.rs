//! Kuraso BYOK AI router, OS keychain storage, and programmatic `[P#]` citation verifier.
//!
//! Security contract:
//! - API keys live ONLY in the OS keychain (`keyring` crate) under service `org.kuraso.desktop`.
//! - Keys never enter files, SQLite, logs, exports, or the webview.
//! - All remote AI HTTP requests originate from this Rust crate.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use thiserror::Error;

pub const KEYCHAIN_SERVICE: &str = "org.kuraso.desktop";

#[derive(Debug, Error)]
pub enum AiError {
    #[error("Keychain error: {0}")]
    Keychain(String),
    #[error("Network error: {0}")]
    Network(String),
    #[error("Provider error: {0}")]
    Provider(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderKind {
    OpenaiCompatible,
    Anthropic,
    Ollama,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRequestConfig {
    pub id: String,
    pub kind: ProviderKind,
    pub base_url: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VerifiedCitations {
    pub valid: Vec<String>,
    pub invalid: Vec<String>,
}

/// Store a provider API key in the OS keychain (never on disk or in settings).
pub fn store_api_key(provider_id: &str, api_key: &str) -> Result<(), AiError> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, provider_id)
        .map_err(|e| AiError::Keychain(e.to_string()))?;
    entry
        .set_password(api_key)
        .map_err(|e| AiError::Keychain(e.to_string()))
}

/// Load a provider API key from the OS keychain.
pub fn load_api_key(provider_id: &str) -> Result<Option<String>, AiError> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, provider_id)
        .map_err(|e| AiError::Keychain(e.to_string()))?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AiError::Keychain(e.to_string())),
    }
}

/// Delete a provider API key from the OS keychain.
pub fn delete_api_key(provider_id: &str) -> Result<(), AiError> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, provider_id)
        .map_err(|e| AiError::Keychain(e.to_string()))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AiError::Keychain(e.to_string())),
    }
}

fn classify_http_error(status: u16, body: &str) -> AiError {
    let lower = body.to_ascii_lowercase();
    if status == 401 || status == 403 || lower.contains("invalid api key") {
        return AiError::Provider("Invalid API key. Check your key in Settings.".to_string());
    }
    if status == 402 || lower.contains("insufficient_quota") || lower.contains("credit") {
        return AiError::Provider("No credit left on this provider account.".to_string());
    }
    if status == 404 || lower.contains("model_not_found") {
        return AiError::Provider("Model not found. Choose another model.".to_string());
    }
    if status == 429 || lower.contains("rate limit") {
        return AiError::Provider("Rate limited by provider. Try again shortly.".to_string());
    }
    AiError::Provider(format!("Provider HTTP {status}: {}", &body[..body.len().min(160)]))
}

/// Execute a chat completion request directly from Rust using the key stored in the OS keychain.
pub async fn run_chat(
    config: &ProviderRequestConfig,
    messages: &[ChatMessage],
) -> Result<String, AiError> {
    let client = reqwest::Client::new();
    let base = config.base_url.trim_end_matches('/');

    match config.kind {
        ProviderKind::Ollama => {
            let url = format!(
                "{}/api/chat",
                if base.is_empty() {
                    "http://localhost:11434"
                } else {
                    base
                }
            );
            let res = client
                .post(&url)
                .json(&serde_json::json!({
                    "model": config.model,
                    "messages": messages,
                    "stream": false,
                    "options": { "temperature": 0.2 }
                }))
                .send()
                .await
                .map_err(|e| AiError::Network(format!("Cannot reach Ollama: {e}")))?;

            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            if !(200..300).contains(&status) {
                return Err(classify_http_error(status, &body));
            }
            let parsed: serde_json::Value =
                serde_json::from_str(&body).map_err(|e| AiError::Provider(e.to_string()))?;
            Ok(parsed["message"]["content"]
                .as_str()
                .unwrap_or_default()
                .to_string())
        }
        ProviderKind::Anthropic => {
            let api_key = load_api_key(&config.id)?.unwrap_or_default();
            let url = format!(
                "{}/v1/messages",
                if base.is_empty() {
                    "https://api.anthropic.com"
                } else {
                    base
                }
            );
            let system_text = messages
                .iter()
                .find(|m| m.role == "system")
                .map(|m| m.content.as_str())
                .unwrap_or("");
            let non_system: Vec<&ChatMessage> =
                messages.iter().filter(|m| m.role != "system").collect();

            let res = client
                .post(&url)
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&serde_json::json!({
                    "model": config.model,
                    "max_tokens": 1500,
                    "temperature": 0.2,
                    "system": system_text,
                    "messages": non_system
                }))
                .send()
                .await
                .map_err(|e| AiError::Network(format!("Cannot reach Anthropic: {e}")))?;

            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            if !(200..300).contains(&status) {
                return Err(classify_http_error(status, &body));
            }
            let parsed: serde_json::Value =
                serde_json::from_str(&body).map_err(|e| AiError::Provider(e.to_string()))?;
            let text = parsed["content"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|item| item["text"].as_str())
                        .collect::<Vec<_>>()
                        .join("")
                })
                .unwrap_or_default();
            Ok(text)
        }
        ProviderKind::OpenaiCompatible => {
            let api_key = load_api_key(&config.id)?;
            let url = format!("{base}/chat/completions");
            let mut req = client.post(&url).json(&serde_json::json!({
                "model": config.model,
                "messages": messages,
                "temperature": 0.2
            }));
            if let Some(key) = api_key {
                if !key.is_empty() {
                    req = req.bearer_auth(key);
                }
            }
            let res = req
                .send()
                .await
                .map_err(|e| AiError::Network(format!("Cannot reach AI server: {e}")))?;

            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            if !(200..300).contains(&status) {
                return Err(classify_http_error(status, &body));
            }
            let parsed: serde_json::Value =
                serde_json::from_str(&body).map_err(|e| AiError::Provider(e.to_string()))?;
            Ok(parsed["choices"][0]["message"]["content"]
                .as_str()
                .unwrap_or_default()
                .to_string())
        }
    }
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
