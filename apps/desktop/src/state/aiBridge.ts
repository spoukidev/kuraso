import { callProviderChat, type ChatMessage } from "@kuraso/ai";
import type { AISettings } from "./aiStore";

/**
 * One door for every AI request.
 *
 * - In the desktop app (Tauri) requests go through the Rust core (`kuraso-ai`):
 *   no CORS, no webview CSP, and the API key is read from the OS keychain.
 * - In a plain browser (`pnpm dev` preview) we fall back to a direct fetch
 *   with the key kept in memory for the session.
 */

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function getInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") return null;
  const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke?: TauriInvoke } })
    .__TAURI_INTERNALS__;
  return typeof internals?.invoke === "function" ? internals.invoke : null;
}

export function isDesktopRuntime(): boolean {
  return getInvoke() !== null;
}

function cleanError(err: unknown, fallback: string): Error {
  const raw = typeof err === "string" ? err : err instanceof Error ? err.message : fallback;
  // Rust errors arrive as "Network error: …" / "Provider error: …" / "Keychain error: …".
  const msg = raw.replace(/^(Network|Provider) error:\s*/i, "");
  if (/keychain/i.test(raw)) {
    return new Error(`Could not use your system keychain: ${msg.replace(/^Keychain error:\s*/i, "")}`);
  }
  return new Error(msg || fallback);
}

/** Store a provider key. Desktop: OS keychain. Browser preview: returns false (caller keeps it in memory). */
export async function saveProviderKey(providerId: string, apiKey: string): Promise<boolean> {
  const invoke = getInvoke();
  if (!invoke) return false;
  try {
    await invoke("ai_save_key", { providerId, apiKey });
    return true;
  } catch (err) {
    throw cleanError(err, "Could not save the API key.");
  }
}

export async function hasProviderKey(providerId: string): Promise<boolean> {
  const invoke = getInvoke();
  if (!invoke) return false;
  try {
    return Boolean(await invoke("ai_has_key", { providerId }));
  } catch {
    return false;
  }
}

export async function deleteProviderKey(providerId: string): Promise<void> {
  const invoke = getInvoke();
  if (!invoke) return;
  try {
    await invoke("ai_delete_key", { providerId });
  } catch (err) {
    throw cleanError(err, "Could not remove the API key.");
  }
}

export interface RunChatOptions {
  settings: Pick<AISettings, "providerId" | "kind" | "baseUrl" | "model" | "local">;
  /** Only used in the browser preview; the desktop app reads the key from the keychain. */
  sessionApiKey?: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

export async function runChat({ settings, sessionApiKey, messages, signal }: RunChatOptions): Promise<{ text: string }> {
  const invoke = getInvoke();

  if (!invoke) {
    return callProviderChat({
      kind: settings.kind,
      baseUrl: settings.baseUrl,
      apiKey: settings.local ? undefined : sessionApiKey,
      model: settings.model,
      messages,
      signal,
    });
  }

  const request = invoke("ai_run_chat", {
    config: {
      id: settings.providerId,
      kind: settings.kind,
      baseUrl: settings.baseUrl,
      model: settings.model,
    },
    messages,
  }).then((text) => ({ text: typeof text === "string" ? text : "" }));

  if (!signal) {
    return request.catch((err) => {
      throw cleanError(err, "AI request failed.");
    });
  }

  // The Rust request can't be cancelled mid-flight; stop waiting for it instead.
  const aborted = new Promise<never>((_, reject) => {
    if (signal.aborted) reject(new Error("Request stopped by user."));
    signal.addEventListener("abort", () => reject(new Error("Request stopped by user.")), { once: true });
  });
  return Promise.race([
    request.catch((err) => {
      throw cleanError(err, "AI request failed.");
    }),
    aborted,
  ]);
}
