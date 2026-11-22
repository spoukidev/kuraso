#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use kuraso_ai::{ChatMessage, ProviderRequestConfig};
use kuraso_index::{RebuildStats, SearchHit, SearchIndex};
use kuraso_library::{CollectionsFile, Library, PaperMeta, SyncConflict};
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

#[tauri::command]
fn init_library(library_path: String) -> Result<Vec<PaperMeta>, String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    lib.list_papers().map_err(|e| e.to_string())
}

#[tauri::command]
fn import_pdf_to_library(
    library_path: String,
    index_path: String,
    source_pdf_path: String,
    title: String,
    year: Option<i32>,
    doi: Option<String>,
) -> Result<PaperMeta, String> {
    let bytes = fs::read(&source_pdf_path).map_err(|e| format!("Failed to read source PDF: {e}"))?;
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    let meta = lib
        .import_pdf_bytes(&title, &bytes, year, doi)
        .map_err(|e| e.to_string())?;
    let mut idx = SearchIndex::open(&PathBuf::from(index_path)).map_err(|e| e.to_string())?;
    let _ = idx.rebuild_from_library(&lib);
    Ok(meta)
}

#[tauri::command]
fn save_paper_meta(library_path: String, meta: PaperMeta) -> Result<(), String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    lib.save_paper_meta(&meta).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_collections(library_path: String) -> Result<CollectionsFile, String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    lib.load_collections().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_collections(library_path: String, data: CollectionsFile) -> Result<(), String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    lib.save_collections(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn rebuild_index(library_path: String, index_path: String) -> Result<RebuildStats, String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    let mut idx = SearchIndex::open(&PathBuf::from(index_path)).map_err(|e| e.to_string())?;
    idx.rebuild_from_library(&lib).map_err(|e| e.to_string())
}

#[tauri::command]
fn search_library(index_path: String, query: String, limit: Option<usize>) -> Result<Vec<SearchHit>, String> {
    let idx = SearchIndex::open(&PathBuf::from(index_path)).map_err(|e| e.to_string())?;
    idx.search(&query, limit.unwrap_or(50))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn scan_sync_conflicts(library_path: String) -> Result<Vec<SyncConflict>, String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    lib.scan_sync_conflicts().map_err(|e| e.to_string())
}

#[tauri::command]
fn read_paper_notes(library_path: String, slug: String) -> Result<String, String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    lib.read_paper_notes(&slug).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_paper_notes(library_path: String, slug: String, markdown: String) -> Result<(), String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    lib.save_paper_notes(&slug, &markdown)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn load_annotations_raw(library_path: String, slug: String) -> Result<Option<String>, String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    lib.load_annotations_raw(&slug).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_annotations_raw(library_path: String, slug: String, json: String) -> Result<(), String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    lib.save_annotations_raw(&slug, &json)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn load_structure_raw(library_path: String, slug: String) -> Result<Option<String>, String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    lib.load_structure_raw(&slug).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_structure_raw(
    library_path: String,
    slug: String,
    json: String,
    backup_version: Option<u32>,
) -> Result<(), String> {
    let lib = Library::open_or_init(PathBuf::from(library_path)).map_err(|e| e.to_string())?;
    lib.save_structure_raw(&slug, &json, backup_version)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn ai_save_key(provider_id: String, api_key: String) -> Result<(), String> {
    kuraso_ai::store_api_key(&provider_id, &api_key).map_err(|e| e.to_string())
}

#[tauri::command]
fn ai_has_key(provider_id: String) -> Result<bool, String> {
    kuraso_ai::load_api_key(&provider_id)
        .map(|opt| opt.is_some())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn ai_delete_key(provider_id: String) -> Result<(), String> {
    kuraso_ai::delete_api_key(&provider_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_run_chat(
    config: ProviderRequestConfig,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    kuraso_ai::run_chat(&config, &messages)
        .await
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_runtime_info,
            read_pdf_bytes,
            get_launch_files,
            init_library,
            import_pdf_to_library,
            save_paper_meta,
            load_collections,
            save_collections,
            rebuild_index,
            search_library,
            scan_sync_conflicts,
            read_paper_notes,
            save_paper_notes,
            load_annotations_raw,
            save_annotations_raw,
            load_structure_raw,
            save_structure_raw,
            ai_save_key,
            ai_has_key,
            ai_delete_key,
            ai_run_chat
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kuraso desktop application");
}
