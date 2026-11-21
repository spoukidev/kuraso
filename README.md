# 📒 Kuraso

> **An open-source, local-first desktop app where students and researchers read papers, understand them, and keep what they learn.**
>
> Calm reading · grounded AI with your own key · notes in plain Markdown.

*Kuraso* comes from Arabic *kurrāsa* (كراسة, a scholar's notebook) and Swahili *kurasa* ("pages"), pronounced **koo-RAH-so** in English, French, and Arabic.

---

## Core Principles

1. **Reading comes first.** Calm, paper-like PDF reading on modest laptops (4 GB RAM minimum).
2. **Files are the source of truth.** Untouched PDFs, plain Markdown notes (`notes.md`), and W3C JSON annotations (`annotations.json`). The SQLite index lives in local app-data and is safely rebuildable—so your library folder works cleanly with Dropbox, OneDrive, Nextcloud, or Syncthing.
3. **Grounded BYOK AI.** Bring your own API key (including free-tier, no-credit-card options like Gemini AI Studio, Groq, OpenRouter `:free`, university gateways) or free local Ollama. Every AI sentence cites a verified paragraph ID (`[P12]`) linked directly to the source passage.
4. **Free & interoperable.** GPL-3.0 desktop app, MIT file-format schemas, designed to work alongside Zotero and Obsidian.

## Repository Layout

```
kuraso/
├── apps/
│   └── desktop/            # Tauri 2 desktop app (React/TS + Rust core)
├── crates/
│   ├── kuraso-pdf/         # PDFium wrapper, headings, paragraph segmentation
│   ├── kuraso-library/     # File-based library, atomic writes, file watcher
│   ├── kuraso-index/       # Rebuildable SQLite + FTS5 index
│   └── kuraso-ai/          # BYOK adapters, [P#] grounding & citation checks
├── packages/
│   ├── formats/            # MIT JSON schemas, TypeScript types & providers.json
│   ├── ui/                 # Design tokens (light/dark/sepia, CSS logical props)
│   └── reader/             # pdf.js wrapper & locked PDF coordinate helpers
├── eval/                   # 200-paper benchmark manifest & AI evaluation scripts
└── docs/                   # Project brief & architecture documentation
```

## Documentation

- [Project Brief (v2.1)](docs/PROJECT_BRIEF.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Governance](GOVERNANCE.md)

## Quick Start (Phase 0 Verification)

Run the zero-dependency format schema and coordinate-conversion tests with Node 20+:

```bash
npm run test:formats
npm run test:reader
```

Full workspace setup (requires `pnpm` 9+ and Rust stable):

```bash
pnpm install
cargo test --workspace
```

## License

- **Desktop app & Rust core:** [GNU GPL-3.0](LICENSE)
- **File formats, schemas (`packages/formats`), SDKs, importers/exporters:** [MIT](packages/formats/LICENSE)
