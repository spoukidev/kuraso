# Contributing to Kuraso

Thank you for your interest in Kuraso! Whether you are fixing a bug, adding a new AI provider preset, translating the UI, or testing PDF layouts, contributions are welcome.

## Good First Contributions

- Add or update a provider preset in `packages/formats/providers.json`
- Add test cases to `packages/reader/test/` or `packages/formats/test/`
- Improve translations (English, French, Arabic)
- Report tricky PDF layouts for our 200-paper benchmark in `eval/`

## Development Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Rust** stable toolchain (`rustup`)
- Platform dependencies for [Tauri 2](https://v2.tauri.app/start/prerequisites/)

## Workflow

1. Fork the repository and create a branch from `main`.
2. Keep pull requests focused and small.
3. Run tests before opening a PR:
   - `npm run test:formats`
   - `npm run test:reader`
   - `cargo test --workspace`
   - `cargo clippy --workspace --all-targets`
4. Major architectural or format changes require a short RFC in `docs/rfcs/`.

## Code Conventions

- **CSS:** Always use CSS logical properties (`margin-inline-start`, `padding-block`, `inset-inline-end`) so RTL (Arabic) works automatically.
- **Coordinates:** Never convert PDF coordinates ad-hoc. Always use `pdfToViewport` / `viewportToPdf` from `@kuraso/reader`.
- **Secrets:** API keys must live only in the OS keychain (`keyring` crate in Rust) and never enter the webview, logs, or library files.
