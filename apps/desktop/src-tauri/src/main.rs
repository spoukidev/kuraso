#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use kuraso_ai::{ChatMessage, ProviderRequestConfig};
use kuraso_index::{RebuildStats, SearchHit, SearchIndex};
use kuraso_library::{CollectionsFile, Library, PaperMeta, SyncConflict};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

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
    if !kuraso_pdf::is_pdf_path(Path::new(&source_pdf_path)) {
        return Err("Only .pdf files can be imported".to_string());
    }
    let bytes =
        fs::read(&source_pdf_path).map_err(|e| format!("Failed to read source PDF: {e}"))?;
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
fn search_library(
    index_path: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchHit>, String> {
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInfo {
    version: String,
    current_version: String,
    body: Option<String>,
}

#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await.map_err(|e| e.to_string())? {
        Some(update) => Ok(Some(UpdateInfo {
            version: update.version,
            current_version: update.current_version,
            body: update.body,
        })),
        None => Ok(None),
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_chunk_len, _content_len| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    }
    Ok(())
}

// ── Paper store ──────────────────────────────────────────────────────────────
// Plain files the reader can always open: <Documents>/Kuraso/papers/<paper-id>/
//   paper.pdf · notes.md · annotations.json
// Paper ids come from the webview, so they are validated before touching the disk.

const STORE_FILES: [&str; 2] = ["notes.md", "annotations.json"];

fn valid_paper_id(id: &str) -> Result<(), String> {
    let ok = !id.is_empty()
        && id.len() <= 80
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if ok {
        Ok(())
    } else {
        Err("Invalid paper id".to_string())
    }
}

fn store_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .document_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| format!("No folder available for the library: {e}"))?;
    Ok(base.join("Kuraso"))
}

fn paper_dir(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    valid_paper_id(id)?;
    Ok(store_root(app)?.join("papers").join(id))
}

/// Write via a temporary file and rename, so a crash never leaves half a file.
fn write_file_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let dir = path.parent().ok_or("Invalid path")?;
    fs::create_dir_all(dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, bytes).map_err(|e| format!("Could not write {}: {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| format!("Could not save {}: {e}", path.display()))
}

#[tauri::command]
fn store_location(app: tauri::AppHandle) -> Result<String, String> {
    Ok(store_root(&app)?.display().to_string())
}

/// Ids of papers whose PDF is stored on disk.
#[tauri::command]
fn store_list_pdfs(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let papers = store_root(&app)?.join("papers");
    let Ok(entries) = fs::read_dir(&papers) else {
        return Ok(Vec::new());
    };
    Ok(entries
        .flatten()
        .filter(|e| e.path().join("paper.pdf").is_file())
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|id| valid_paper_id(id).is_ok())
        .collect())
}

/// Raw-body command: the PDF bytes arrive as the invoke body, the paper id in a header.
#[tauri::command]
fn store_save_pdf(app: tauri::AppHandle, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected raw PDF bytes".to_string());
    };
    if !bytes.starts_with(b"%PDF") {
        return Err("Not a PDF file".to_string());
    }
    let id = request
        .headers()
        .get("x-paper-id")
        .and_then(|v| v.to_str().ok())
        .ok_or("Missing paper id")?;
    write_file_atomic(&paper_dir(&app, id)?.join("paper.pdf"), bytes)
}

#[tauri::command]
fn store_load_pdf(app: tauri::AppHandle, id: String) -> Result<tauri::ipc::Response, String> {
    let path = paper_dir(&app, &id)?.join("paper.pdf");
    let bytes = fs::read(&path).map_err(|e| format!("PDF not found on disk: {e}"))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn store_save_text(
    app: tauri::AppHandle,
    id: String,
    name: String,
    text: String,
) -> Result<(), String> {
    if !STORE_FILES.contains(&name.as_str()) {
        return Err("Unknown store file".to_string());
    }
    write_file_atomic(&paper_dir(&app, &id)?.join(&name), text.as_bytes())
}

#[tauri::command]
fn store_load_text(
    app: tauri::AppHandle,
    id: String,
    name: String,
) -> Result<Option<String>, String> {
    if !STORE_FILES.contains(&name.as_str()) {
        return Err("Unknown store file".to_string());
    }
    let path = paper_dir(&app, &id)?.join(&name);
    if !path.is_file() {
        return Ok(None);
    }
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn store_remove_paper(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let dir = paper_dir(&app, &id)?;
    if dir.is_dir() {
        fs::remove_dir_all(&dir).map_err(|e| format!("Could not remove {}: {e}", dir.display()))?;
    }
    Ok(())
}

#[derive(Debug, Serialize)]
struct HttpText {
    status: u16,
    body: String,
}

/// Metadata lookups run here, not in the webview: arXiv's API no longer sends CORS
/// headers, so a browser fetch from the app window is blocked. Only these two
/// endpoints are reachable through this command.
#[tauri::command]
async fn metadata_get(url: String) -> Result<HttpText, String> {
    const ALLOWED: [&str; 2] = [
        "https://api.crossref.org/works/",
        "https://export.arxiv.org/api/query?",
    ];
    if !ALLOWED.iter().any(|p| url.starts_with(p)) {
        return Err("This address is not allowed".to_string());
    }
    let client = reqwest::Client::builder()
        .user_agent(concat!(
            "Kuraso/",
            env!("CARGO_PKG_VERSION"),
            " (https://github.com/spoukidev/kuraso)"
        ))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| e.to_string())?;
    Ok(HttpText { status, body })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            ai_run_chat,
            check_for_update,
            install_update,
            store_location,
            store_list_pdfs,
            store_save_pdf,
            store_load_pdf,
            store_save_text,
            store_load_text,
            store_remove_paper,
            metadata_get
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kuraso desktop application");
}
