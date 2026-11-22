/**
 * 3 v0.1 BYOK AI provider adapters:
 *   1. OpenAI-compatible (Google AI Studio, Groq, OpenRouter, OpenAI, Mistral, university gateways)
 *   2. Anthropic (Claude Messages API)
 *   3. Ollama (local, offline)
 */

function classifyHttpError(status, bodyText) {
  const lower = (bodyText ?? "").toLowerCase();
  if (status === 401 || status === 403 || lower.includes("invalid api key") || lower.includes("authentication")) {
    return "Invalid API key. Check your key in Settings.";
  }
  if (status === 402 || lower.includes("insufficient_quota") || lower.includes("credit") || lower.includes("billing")) {
    return "No credit left on this provider account.";
  }
  if (status === 404 || lower.includes("model_not_found") || lower.includes("not found")) {
    return "Model not found. Pick another model from the list.";
  }
  if (status === 429 || lower.includes("rate limit")) {
    return "Rate limited by provider. Wait a moment and try again.";
  }
  return `Provider returned HTTP ${status}: ${bodyText.slice(0, 160)}`;
}

export async function callProviderChat({
  kind,
  baseUrl,
  apiKey,
  model,
  messages,
  signal,
  fetchImpl = globalThis.fetch,
}) {
  const cleanBase = (baseUrl ?? "").replace(/\/+$/, "");

  try {
    if (kind === "ollama") {
      const url = `${cleanBase || "http://localhost:11434"}/api/chat`;
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0.2 } }),
        signal,
      });
      if (!res.ok) throw new Error(classifyHttpError(res.status, await res.text()));
      const data = await res.json();
      return { text: data?.message?.content ?? "" };
    }

    if (kind === "anthropic") {
      const url = `${cleanBase || "https://api.anthropic.com"}/v1/messages`;
      const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
      const userMsgs = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          temperature: 0.2,
          system: systemMsg,
          messages: userMsgs,
        }),
        signal,
      });
      if (!res.ok) throw new Error(classifyHttpError(res.status, await res.text()));
      const data = await res.json();
      const text = Array.isArray(data?.content)
        ? data.content.map((c) => c.text ?? "").join("")
        : "";
      return { text };
    }

    // Default: OpenAI-compatible
    const url = `${cleanBase}/chat/completions`;
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
      }),
      signal,
    });
    if (!res.ok) throw new Error(classifyHttpError(res.status, await res.text()));
    const data = await res.json();
    return { text: data?.choices?.[0]?.message?.content ?? "" };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request stopped by user.");
    }
    if (err instanceof TypeError) {
      throw new Error("Cannot reach AI server. Check your internet connection or local Ollama.");
    }
    throw err;
  }
}

export async function testProviderConnection({
  kind,
  baseUrl,
  apiKey,
  model,
  fetchImpl = globalThis.fetch,
}) {
  await callProviderChat({
    kind,
    baseUrl,
    apiKey,
    model,
    messages: [{ role: "user", content: "Reply with OK." }],
    fetchImpl,
  });
  return { ok: true };
}
