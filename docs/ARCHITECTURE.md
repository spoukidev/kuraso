# Kuraso — Architecture & Locked Conventions (v2.1)

## 1. Fixed Identifiers (Phase 0)

| Item | Value |
|---|---|
| App name | `Kuraso` |
| Tauri app identifier | `org.kuraso.desktop` |
| Deep-link URL scheme | `kuraso://` |
| Default library folder | `Documents/Kuraso` |
| OS app-data folder | `Kuraso` |
| Library marker file | `kuraso-library.json` |
| npm package scope | `@kuraso/*` |
| Rust crate prefix | `kuraso-*` |

## 2. Source of Truth & Storage Split

- **Library folder (`Documents/Kuraso/`, safe for Dropbox/OneDrive/Syncthing):**
  - `kuraso-library.json` — library ID & format version
  - `collections.json` — nested collections, paper membership, colors
  - `papers/<slug>/paper.pdf` — original untouched PDF
  - `papers/<slug>/meta.json` — metadata, reading status, tags
  - `papers/<slug>/structure.json` — `parserVersion`, headings, `P1..Pn` paragraphs with PDF-space anchors
  - `papers/<slug>/annotations.json` — W3C Web Annotation Data Model (dual selectors)
  - `papers/<slug>/notes.md` — user Markdown notes (editable in Obsidian or any editor)
  - `papers/<slug>/ai/summary.md` — cached AI outputs (explicitly marked as AI-generated)
- **Local OS app-data (`<OS app-data>/Kuraso/`, never synced):**
  - `index.sqlite` — rebuildable metadata + FTS5 full-text index (+ `sqlite-vec` in v0.5)
  - `settings.json`, `backups/`, `logs/`

All writes to library files are **atomic** (write temp file, then rename). If the index disagrees with files, **files win**. Deleting `index.sqlite` is always safe and triggers a full rebuild on startup.

## 3. Locked PDF Coordinate Convention

Every stored rectangle in `structure.json` and `annotations.json` uses:
- **PDF user-space points**, unscaled
- Relative to the page **CropBox**
- **Bottom-left origin**, **before** `/Rotate` is applied
- Format: `[x1, y1, x2, y2]` where `x1 < x2` and `y1 < y2`

Only `pdfToViewport` and `viewportToPdf` in `@kuraso/reader` are allowed to convert between stored PDF rects and `pdf.js` viewport CSS pixel coordinates.

## 4. AI Grounding & BYOK Security

- **No Kuraso AI server.** Requests go directly from the Rust core (`kuraso-ai`) to the user's chosen provider.
- **Keys live only in the OS keychain** (`keyring` crate) and never enter the webview.
- **Single-paper grounding (v0.1):** Paragraphs are labeled `[P1]..[Pn]`. Every `[P#]` cited by the model is programmatically verified to exist in `structure.json`; invalid IDs are stripped and unsupported sentences are flagged.
- **v0.1 adapters:** OpenAI-compatible (covers Gemini free tier, Groq, OpenRouter `:free`, OpenAI, Mistral, LM Studio, university gateways), Anthropic, and Ollama.
