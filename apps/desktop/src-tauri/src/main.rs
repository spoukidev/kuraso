//! Kuraso Tauri 2 desktop core entrypoint (Phase 0 skeleton).
//! Full Tauri runtime wiring and IPC commands arrive in Phase 1.

fn main() {
    println!(
        "Kuraso core initialized (format={}, parser=v{})",
        kuraso_library::FORMAT_VERSION,
        kuraso_pdf::PARSER_VERSION
    );
}
