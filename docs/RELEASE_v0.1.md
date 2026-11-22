# Kuraso v0.1 Public Alpha — Release Guide

## Release Checklist

- [ ] All 6 test suites pass (`npm run test:all`, including offline network-isolation test)
- [ ] Strict TypeScript typecheck passes across all packages (`pnpm -r run typecheck`)
- [ ] Rust workspace builds and passes `cargo clippy --workspace --all-targets -- -D warnings` and `cargo test --workspace`
- [ ] Tagged release (`git tag v0.1.0-alpha.1 && git push origin v0.1.0-alpha.1`) triggers `.github/workflows/release.yml`
- [ ] Verify Windows (`.msi`/`.exe`), macOS (`.dmg`), and Linux (`.AppImage`/`.deb`) bundles

## Code Signing Status (v0.1 Alpha)

If Windows Authenticode (SignPath) or Apple Developer ID notarization is still pending for the initial public alpha, include these instructions in the GitHub Release notes:

- **Windows (SmartScreen):** Click **More info** → **Run anyway**.
- **macOS (Gatekeeper):** Right-click `Kuraso.app` → **Open** → confirm **Open**, or run `xattr -cr /Applications/Kuraso.app`.
- **Linux:** Mark the `.AppImage` executable (`chmod +x Kuraso*.AppImage`) and run it directly.

Signed builds and in-app auto-updates ship as soon as SignPath + Apple notarization are active (v0.1.1 / v0.2).
