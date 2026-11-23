# Kuraso v1.0 Package-Manager Distribution

Once `v1.0.0` GitHub Releases are published (`.github/workflows/release.yml`), submit Kuraso to the 4 primary desktop package managers:

| OS | Channel | Command |
|---|---|---|
| **Windows** | `winget` (`microsoft/winget-pkgs`) | `winget install Kuraso.Kuraso` |
| **Windows** | Scoop (`ScoopInstaller/Extras`) | `scoop install kuraso` |
| **macOS** | Homebrew Cask (`homebrew-cask`) | `brew install --cask kuraso` |
| **Linux** | Flathub (`org.kuraso.desktop`) | `flatpak install flathub org.kuraso.desktop` |

## Stable 1.0 File-Format Guarantee

As of `KURASO_FORMAT_VERSION = "1.0.0"`, all MIT-licensed schemas in `packages/formats/schemas/` (`kuraso-library`, `collections`, `meta`, `structure`, `annotations`, `projects`, `recipes`) follow strict backward-compatible evolution:
- Additive optional fields only within `1.x`.
- `structure.json` remains versioned via `parserVersion` with automatic `.bak.json` preservation and `TextQuoteSelector` remapping on re-parse.
- Stored coordinates remain locked to `pdf-cropbox-points-bl-unrotated`.
