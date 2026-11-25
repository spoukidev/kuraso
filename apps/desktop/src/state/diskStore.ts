/**
 * Paper store on disk (desktop only).
 *
 * <Documents>/Kuraso/papers/<paper-id>/ holds paper.pdf, notes.md and annotations.json,
 * so papers reopen after a restart and notes survive even if the webview's
 * localStorage is cleared or full. In a plain browser preview every call is a no-op.
 */

type Invoke = (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>;

function getInvoke(): Invoke | null {
  const internals = (window as { __TAURI_INTERNALS__?: { invoke?: Invoke } }).__TAURI_INTERNALS__;
  return internals?.invoke ? internals.invoke.bind(internals) : null;
}

export function diskStoreAvailable(): boolean {
  return getInvoke() !== null;
}

export async function storeLocation(): Promise<string | null> {
  const invoke = getInvoke();
  if (!invoke) return null;
  try {
    return String(await invoke("store_location"));
  } catch {
    return null;
  }
}

/** Ids of papers whose PDF is saved on disk. */
export async function listStoredPdfs(): Promise<Set<string>> {
  const invoke = getInvoke();
  if (!invoke) return new Set();
  try {
    const ids = await invoke("store_list_pdfs");
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  } catch {
    return new Set();
  }
}

/** Sends the bytes as a raw body (no JSON encoding), so large PDFs stay fast. */
export async function savePdfToDisk(paperId: string, bytes: Uint8Array): Promise<boolean> {
  const invoke = getInvoke();
  if (!invoke) return false;
  await invoke("store_save_pdf", bytes, { headers: { "x-paper-id": paperId } });
  return true;
}

export async function loadPdfFromDisk(paperId: string): Promise<Uint8Array | null> {
  const invoke = getInvoke();
  if (!invoke) return null;
  try {
    const res = await invoke("store_load_pdf", { id: paperId });
    if (res instanceof ArrayBuffer) return new Uint8Array(res);
    if (res instanceof Uint8Array) return res;
    if (Array.isArray(res)) return new Uint8Array(res as number[]);
    return null;
  } catch {
    return null;
  }
}

type StoreFile = "notes.md" | "annotations.json";

export async function loadTextFromDisk(paperId: string, name: StoreFile): Promise<string | null> {
  const invoke = getInvoke();
  if (!invoke) return null;
  try {
    const res = await invoke("store_load_text", { id: paperId, name });
    return typeof res === "string" ? res : null;
  } catch {
    return null;
  }
}

// Writes are coalesced per file: typing a note does not hit the disk on every key.
const pending = new Map<string, { timer: number; run: () => Promise<void> }>();
let onWriteError: ((message: string) => void) | null = null;

export function setDiskWriteErrorHandler(handler: ((message: string) => void) | null): void {
  onWriteError = handler;
}

export function saveTextToDisk(paperId: string, name: StoreFile, text: string, delayMs = 500): void {
  const invoke = getInvoke();
  if (!invoke) return;
  const key = `${paperId}/${name}`;
  const prev = pending.get(key);
  if (prev) window.clearTimeout(prev.timer);
  const run = async () => {
    pending.delete(key);
    try {
      await invoke("store_save_text", { id: paperId, name, text });
    } catch (err) {
      onWriteError?.(err instanceof Error ? err.message : String(err));
    }
  };
  pending.set(key, { timer: window.setTimeout(() => void run(), delayMs), run });
}

/** Write everything still waiting (called when the window is hidden or closing). */
export function flushDiskWrites(): void {
  for (const { timer, run } of Array.from(pending.values())) {
    window.clearTimeout(timer);
    void run();
  }
}

export async function removePaperFromDisk(paperId: string): Promise<void> {
  const invoke = getInvoke();
  if (!invoke) return;
  await invoke("store_remove_paper", { id: paperId });
}

/**
 * fetch() stand-in for metadata lookups. On desktop the request runs in Rust
 * (arXiv's API sends no CORS headers, so the webview cannot call it directly).
 */
export async function metadataFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const invoke = getInvoke();
  if (!invoke) return fetch(url);
  const res = (await invoke("metadata_get", { url })) as { status: number; body: string };
  return new Response(res.body, { status: res.status });
}
