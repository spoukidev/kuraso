# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Kuraso—especially involving PDF parsing, webview CSP/XSS, prompt injection, or API key storage—please **do not** open a public GitHub issue.

Instead, report it privately via GitHub Security Advisories or email the maintainers (security contact to be published before v0.1 public release).

We aim to acknowledge reports within 72 hours and provide a remediation timeline within 7 days.

## Security Model

- **PDFs are untrusted input:** `pdf.js` runs with scripting disabled; PDFium runs in the Rust core with size and resource limits.
- **Strict webview isolation:** API keys are stored only in the OS keychain (`keyring`) and all AI HTTP requests are executed from the Rust core—keys never enter the webview.
- **Sanitized rendering:** All Markdown and AI-generated HTML is sanitized with DOMPurify under a strict CSP.
- **Prompt injection defense:** Paper text is passed as clearly delimited data, never as executable instructions; AI outputs cannot trigger app actions.
