<p align="center">
  <img src="assets/brand/kuraso-banner.jpg" alt="Kuraso — read · mark · keep. The open-source paper reader that remembers what you read." width="100%">
</p>

<h1 align="center">Kuraso</h1>

[![CI](https://github.com/spoukidev/kuraso/actions/workflows/ci.yml/badge.svg)](https://github.com/spoukidev/kuraso/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/spoukidev/kuraso?label=Download)](https://github.com/spoukidev/kuraso/releases/latest)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

> **An open-source, local-first desktop app where students and researchers read papers, understand them, and keep what they learn.**
>
> Calm reading · grounded AI with your own key · notes in plain Markdown · EN / FR / العربية (RTL).

*Kuraso* comes from Arabic *kurrāsa* (كراسة, a scholar's notebook) and Swahili *kurasa* ("pages"), pronounced **koo-RAH-so** in English, French, and Arabic.

---

## Download Kuraso (Free, Windows / macOS / Linux)

| Platform | Direct Download | Size |
|---|---|---|
| **Windows (64-bit)** | [**Download `.exe` Installer**](https://github.com/spoukidev/kuraso/releases/latest/download/Kuraso_2.3.0_x64-setup.exe) · [`.msi`](https://github.com/spoukidev/kuraso/releases/latest/download/Kuraso_2.3.0_x64_en-US.msi) | ~4.2 MB |
| **macOS (Apple Silicon + Intel)** | [**Download Universal `.dmg`**](https://github.com/spoukidev/kuraso/releases/latest/download/Kuraso_2.3.0_universal.dmg) | ~11.4 MB |
| **Linux (Ubuntu / Debian)** | [**Download `.deb`**](https://github.com/spoukidev/kuraso/releases/latest/download/Kuraso_2.3.0_amd64.deb) | ~6.3 MB |
| **Linux (Fedora / RHEL)** | [**Download `.rpm`**](https://github.com/spoukidev/kuraso/releases/latest/download/Kuraso-2.3.0-1.x86_64.rpm) | ~6.3 MB |
| **Linux (Universal)** | [**Download `.AppImage`**](https://github.com/spoukidev/kuraso/releases/latest/download/Kuraso_2.3.0_amd64.AppImage) | ~84 MB |

> **First-time open note (unsigned open-source build):**
> - **Windows:** If SmartScreen appears, click **More info** → **Run anyway**.
> - **macOS:** Right-click `Kuraso.app` → **Open** → confirm **Open**.
> - **Linux AppImage:** Run `chmod +x Kuraso_2.3.0_amd64.AppImage && ./Kuraso_2.3.0_amd64.AppImage`.

---

## Core Features

- **Calm Academic Reader:** Fast `pdf.js` rendering, multi-tab workspace, Light / Sepia / Dark (page-inverted) themes, Smart Margin Crop (`✂`), Clean Reading Mode / Reflow (`Ctrl+R`), Focus Mode (`F11`), and Split View (Paper + `notes.md`).
- **W3C Dual-Anchored Annotations:** 5 semantic, color-blind-safe highlight colors (`1`–`5`), underline, strikethrough, Markdown margin notes (`N`), `#tags`, and Annotation Gathering panel — synced between PDF view and Clean Reading Mode.
- **Files Are the Source of Truth:** Untouched PDFs, Obsidian-friendly `notes.md` with `[[wiki-links]]` + backlinks, and documented JSON schemas. The SQLite + FTS5 index lives in local app-data and rebuilds cleanly from files (safe with Dropbox, OneDrive, Nextcloud, and Syncthing).
- **Grounded BYOK AI (Zero Paywalls):** Connect a **free-tier, no-credit-card API key** (Google AI Studio / Gemini, Groq, OpenRouter `:free`, university gateways), Anthropic, OpenAI, or free offline **Ollama**. Every sentence cites verified `[P#]` paragraphs; hallucinated IDs are stripped by code. Includes TL;DR, Structured Summary, Explain Selection (`Ctrl+E`), Chat, Collection Comparison Tables, Custom Recipes, and Anki Flashcards (`.tsv`).
- **Multilingual & RTL:** Full **English**, **Français**, and **العربية (RTL)** interface with isolated LTR PDF viewport.
- **Interoperable Ecosystem:** DOI / arXiv / BibTeX / Zotero `.bib` import, Obsidian Markdown + BibTeX + APA/IEEE/ACM citation copy, Research Projects, Knowledge Graph, MIT Plugin SDK, CLI (`kuraso`), Browser Extension, and AGPL-3.0 self-hostable sync server.

---

## Repository Layout

```
kuraso/
├── apps/
│   ├── desktop/            # Tauri 2 desktop app (React/TS + Rust core)
│   └── browser-extension/  # "Save to Kuraso" Manifest V3 extension (kuraso://)
├── crates/
│   ├── kuraso-pdf/         # PDFium wrapper, headings, paragraph segmentation
│   ├── kuraso-library/     # File-based library, atomic writes, conflict detection
│   ├── kuraso-index/       # Rebuildable SQLite + FTS5 index
│   └── kuraso-ai/          # OS keychain (keyring) + 3-adapter BYOK AI router
├── packages/
│   ├── formats/            # MIT JSON schemas (v1.0.0), TS types & providers.json
│   ├── ui/                 # Design tokens (light/dark/sepia, CSS logical props)
│   ├── reader/             # pdf.js helpers, locked coordinate math, search, structure
│   ├── importers/          # MIT DOI/arXiv/BibTeX/Zotero importers
│   ├── annotations/        # MIT W3C annotations, remapping & [[wiki-links]]
│   ├── exporters/          # MIT Markdown, BibTeX, APA/IEEE/ACM & Anki TSV
│   ├── ai/                 # Grounded [P#] prompts, verification, recipes & study tools
│   ├── plugin-sdk/         # MIT Plugin API & registry
│   └── cli/                # Kuraso CLI (status, search, export-bib)
├── services/
│   └── sync-server/        # AGPL-3.0 self-hostable sync server (Docker)
└── docs/                   # Architecture, release, distribution & GROBID guides
```

## Development

```bash
pnpm install
npm run test:all
pnpm -r run typecheck
pnpm --filter @kuraso/desktop dev        # UI preview
pnpm --filter @kuraso/desktop tauri dev  # Native desktop app (requires Rust)
```

## License

- **Desktop app & Rust core:** [GNU GPL-3.0](LICENSE)
- **File formats, schemas, importers, exporters, annotations, Plugin SDK:** [MIT](packages/formats/LICENSE)
- **Self-hostable sync server (`services/sync-server`):** [GNU AGPL-3.0](services/sync-server/LICENSE)
