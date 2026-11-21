#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeInfo {
    app_id: &'static str,
    format_version: &'static str,
    parser_version: u32,
    coordinate_space: &'static str,
    pdfium_available: bool,
    os: &'static str,
}

#[tauri::command]
fn get_runtime_info() -> RuntimeInfo {
    let search_dirs = vec![
        PathBuf::from("resources/pdfium"),
        PathBuf::from("apps/desktop/src-tauri/resources/pdfium"),
    ];
    let pdfium_available = kuraso_pdf::locate_pdfium_library(&search_dirs).is_some();

    RuntimeInfo {
        app_id: "org.kuraso.desktop",
        format_version: kuraso_library::FORMAT_VERSION,
        parser_version: kuraso_pdf::PARSER_VERSION,
        coordinate_space: kuraso_pdf::COORDINATE_SPACE,
        pdfium_available,
        os: std::env::consts::OS,
    }
}

#[tauri::command]
fn read_pdf_bytes(path: String) -> Result<Vec<u8>, String> {
    let target = PathBuf::from(&path);
    if !kuraso_pdf::is_pdf_path(&target) {
        return Err("Only .pdf files can be opened by Kuraso".to_string());
    }
    fs::read(&target).map_err(|e| format!("Failed to read PDF file: {e}"))
}

#[tauri::command]
fn get_launch_files() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| kuraso_pdf::is_pdf_path(std::path::Path::new(arg)))
        .collect()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_runtime_info,
            read_pdf_bytes,
            get_launch_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kuraso desktop application");
}
