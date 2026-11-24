import { useState } from "react";
import type { AnswerLanguage, AnswerStyle } from "@kuraso/ai";
import { CheckCircle2, Copy, ExternalLink, KeyRound, ShieldAlert, X } from "lucide-react";
import { PROVIDER_PRESETS, type AISettings } from "../state/aiStore";
import { isDesktopRuntime, runChat, saveProviderKey } from "../state/aiBridge";
import { tr } from "../i18n/tr";

interface AISettingsModalProps {
  open: boolean;
  settings: AISettings;
  hasKey: boolean;
  /** Browser preview only: the key kept in memory for this session. */
  sessionApiKey?: string;
  onClose: () => void;
  onSave: (settings: AISettings, newApiKey: string | null) => void;
  onRemoveKey: () => void;
}

export function AISettingsModal({
  open,
  settings,
  hasKey,
  sessionApiKey,
  onClose,
  onSave,
  onRemoveKey,
}: AISettingsModalProps) {
  const [draft, setDraft] = useState<AISettings>(settings);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!open) return null;

  const activePreset = PROVIDER_PRESETS.find((p) => p.id === draft.providerId);

  function selectPreset(presetId: string) {
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraft((prev) => ({
      ...prev,
      enabled: true,
      providerId: preset.id,
      kind: preset.kind,
      label: preset.label,
      baseUrl: preset.baseUrl,
      model: preset.defaultModel || prev.model,
      local: Boolean(preset.local),
    }));
    setTestResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const typedKey = apiKeyInput.trim();
    try {
      if (!draft.local && !typedKey && !hasKey) {
        throw new Error(tr("Paste your API key first — use “Where do I get a key?” above."));
      }
      if (!draft.local && !draft.baseUrl.trim()) {
        throw new Error(tr("Add the provider's Base URL first."));
      }
      // Desktop: the Rust core reads the key from the OS keychain, so a newly typed key is stored first.
      if (typedKey && isDesktopRuntime()) {
        await saveProviderKey(draft.providerId, typedKey);
      }
      await runChat({
        settings: draft,
        sessionApiKey: typedKey || sessionApiKey,
        messages: [{ role: "user", content: "Reply with OK." }],
      });
      setTestResult({
        ok: true,
        msg: typedKey && isDesktopRuntime()
          ? tr("Connected. Your key is saved in your system keychain.")
          : tr("Connected successfully."),
      });
    } catch (err: unknown) {
      setTestResult({
        ok: false,
        msg: err instanceof Error ? err.message : tr("Connection test failed."),
      });
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    onSave(draft, apiKeyInput.trim() ? apiKeyInput.trim() : null);
    setApiKeyInput("");
    onClose();
  }

  return (
    <div
      className="kuraso-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={tr("AI Provider Settings")}
      onClick={onClose}
    >
      <div className="kuraso-dialog" style={{ width: "min(560px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
        <div className="kuraso-dialog-header">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <KeyRound size={16} />
            <strong>{tr("Bring Your Own AI (Settings)")}</strong>
          </div>
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="kuraso-dialog-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            <span>{tr("Enable AI assistant (requests go directly to your chosen provider)")}</span>
          </label>

          <label className="kuraso-field">
            <span>{tr("Provider (Free, no-credit-card options listed first)")}</span>
            <select
              className="kuraso-input"
              value={draft.providerId}
              onChange={(e) => selectPreset(e.target.value)}
            >
              {PROVIDER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.freeTier && !p.needsCard ? `★ ${tr("Free")} · ` : ""}
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {activePreset && (
            <div className="kuraso-info-box">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span>
                  {activePreset.freeTier && !activePreset.needsCard
                    ? tr("Free tier · No credit card required")
                    : activePreset.local
                      ? tr("Runs locally on your machine (8+ GB RAM recommended)")
                      : tr("Paid API key required")}
                </span>
                <span style={{ opacity: 0.75 }}>{tr("Checked {date}", { date: activePreset.lastChecked })}</span>
              </div>
              {activePreset.rateLimitsNote && (
                <div dir="auto" style={{ marginBlockStart: 4, opacity: 0.85 }}>{activePreset.rateLimitsNote}</div>
              )}
              {activePreset.keyGuideUrl && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBlockStart: 8 }}>
                  <a
                    href={activePreset.keyGuideUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--kuraso-accent)",
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    <span>{tr("Where do I get a key?")}</span>
                    <ExternalLink size={12} />
                  </a>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <code
                      style={{
                        fontFamily: "var(--kuraso-font-mono)",
                        fontSize: 11,
                        userSelect: "all",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {activePreset.keyGuideUrl}
                    </code>
                    <button
                      type="button"
                      className="kuraso-icon-btn"
                      style={{ height: 24, paddingInline: 6 }}
                      title={tr("Copy link — open it in your browser")}
                      onClick={() => {
                        void navigator.clipboard?.writeText(activePreset.keyGuideUrl ?? "");
                        setTestResult({ ok: true, msg: tr("Link copied — paste it into your browser.") });
                      }}
                    >
                      <Copy size={12} />
                      <span>{tr("Copy")}</span>
                    </button>
                  </span>
                </div>
              )}
            </div>
          )}

          {draft.kind !== "anthropic" && (
            <label className="kuraso-field">
              <span>{tr("Base URL")}</span>
              <input
                className="kuraso-input"
                placeholder="https://api.example.com/v1"
                dir="ltr"
                value={draft.baseUrl}
                onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              />
            </label>
          )}

          {!draft.local && (
            <label className="kuraso-field">
              <span>{tr("API key (saved in your system keychain — never in files)")}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="kuraso-input"
                  type="password"
                  dir="ltr"
                  style={{ flex: 1 }}
                  placeholder={hasKey ? `•••••••••••• ${tr("(saved — paste new key to replace)")}` : tr("Paste API key…")}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
                {hasKey && (
                  <button type="button" className="kuraso-icon-btn" onClick={onRemoveKey}>
                    {tr("Remove")}
                  </button>
                )}
              </div>
            </label>
          )}

          <label className="kuraso-field">
            <span>{tr("Model")}</span>
            <input
              className="kuraso-input"
              list="kuraso-model-suggestions"
              dir="ltr"
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            />
            <datalist id="kuraso-model-suggestions">
              {(activePreset?.recommendedModels ?? []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <label className="kuraso-field" style={{ flex: 1 }}>
              <span>{tr("Answer language")}</span>
              <select
                className="kuraso-input"
                value={draft.answerLanguage}
                onChange={(e) =>
                  setDraft({ ...draft, answerLanguage: e.target.value as AnswerLanguage })
                }
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="ar">العربية (Arabic)</option>
                <option value="paper">{tr("Same as paper")}</option>
              </select>
            </label>

            <label className="kuraso-field" style={{ flex: 1 }}>
              <span>{tr("Answer style")}</span>
              <select
                className="kuraso-input"
                value={draft.answerStyle}
                onChange={(e) => setDraft({ ...draft, answerStyle: e.target.value as AnswerStyle })}
              >
                <option value="short">{tr("Short")}</option>
                <option value="balanced">{tr("Balanced")}</option>
                <option value="detailed">{tr("Detailed")}</option>
                <option value="beginner">{tr("Explain like I’m a beginner")}</option>
              </select>
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem" }}>
            <input
              type="checkbox"
              checked={draft.askBeforeCloudSend}
              onChange={(e) => setDraft({ ...draft, askBeforeCloudSend: e.target.checked })}
            />
            <span>{tr("Ask before sending a paper to a cloud AI for the first time")}</span>
          </label>

          {testResult && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.82rem",
                color: testResult.ok ? "var(--kuraso-hl-green-border)" : "var(--kuraso-hl-red-border)",
              }}
            >
              {testResult.ok ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />}
              <span>{testResult.msg}</span>
            </div>
          )}
        </div>

        <div className="kuraso-dialog-footer">
          <button
            type="button"
            className="kuraso-icon-btn"
            disabled={testing || !draft.model.trim()}
            onClick={() => void handleTest()}
          >
            {testing ? tr("Testing…") : tr("Test connection")}
          </button>
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            {tr("Cancel")}
          </button>
          <button type="button" className="kuraso-primary-btn" onClick={handleSave}>
            {tr("Save settings")}
          </button>
        </div>
      </div>
    </div>
  );
}
