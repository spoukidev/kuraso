import { useState } from "react";
import { testProviderConnection, type AnswerLanguage, type AnswerStyle } from "@kuraso/ai";
import { CheckCircle2, ExternalLink, KeyRound, ShieldAlert, X } from "lucide-react";
import { PROVIDER_PRESETS, type AISettings } from "../state/aiStore";

interface AISettingsModalProps {
  open: boolean;
  settings: AISettings;
  hasKey: boolean;
  onClose: () => void;
  onSave: (settings: AISettings, newApiKey: string | null) => void;
  onRemoveKey: () => void;
}

export function AISettingsModal({
  open,
  settings,
  hasKey,
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
    try {
      await testProviderConnection({
        kind: draft.kind,
        baseUrl: draft.baseUrl,
        apiKey: apiKeyInput.trim() || undefined,
        model: draft.model,
      });
      setTestResult({ ok: true, msg: "Connected successfully." });
    } catch (err: unknown) {
      setTestResult({
        ok: false,
        msg: err instanceof Error ? err.message : "Connection test failed.",
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
      aria-label="AI Provider Settings"
      onClick={onClose}
    >
      <div className="kuraso-dialog" style={{ width: "min(560px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
        <div className="kuraso-dialog-header">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <KeyRound size={16} />
            <strong>Bring Your Own AI (Settings)</strong>
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
            <span>Enable AI assistant (requests go directly to your chosen provider)</span>
          </label>

          <label className="kuraso-field">
            <span>Provider (Free, no-credit-card options listed first)</span>
            <select
              className="kuraso-input"
              value={draft.providerId}
              onChange={(e) => selectPreset(e.target.value)}
            >
              {PROVIDER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.freeTier && !p.needsCard ? "★ Free · " : ""}
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
                    ? "Free tier · No credit card required"
                    : activePreset.local
                      ? "Runs locally on your machine (8+ GB RAM recommended)"
                      : "Paid API key required"}
                </span>
                <span style={{ opacity: 0.75 }}>Checked {activePreset.lastChecked}</span>
              </div>
              {activePreset.rateLimitsNote && (
                <div style={{ marginBlockStart: 4, opacity: 0.85 }}>{activePreset.rateLimitsNote}</div>
              )}
              {activePreset.keyGuideUrl && (
                <a
                  href={activePreset.keyGuideUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    marginBlockStart: 6,
                    color: "var(--kuraso-accent)",
                    textDecoration: "none",
                  }}
                >
                  <span>Where do I get a key?</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}

          {draft.kind !== "anthropic" && (
            <label className="kuraso-field">
              <span>Base URL</span>
              <input
                className="kuraso-input"
                placeholder="https://api.example.com/v1"
                value={draft.baseUrl}
                onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              />
            </label>
          )}

          {!draft.local && (
            <label className="kuraso-field">
              <span>API Key (stored in OS keychain in desktop mode; never saved to files)</span>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="kuraso-input"
                  type="password"
                  style={{ flex: 1 }}
                  placeholder={hasKey ? "•••••••••••• (saved — paste new key to replace)" : "Paste API key…"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
                {hasKey && (
                  <button type="button" className="kuraso-icon-btn" onClick={onRemoveKey}>
                    Remove
                  </button>
                )}
              </div>
            </label>
          )}

          <label className="kuraso-field">
            <span>Model</span>
            <input
              className="kuraso-input"
              list="kuraso-model-suggestions"
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
              <span>Answer language</span>
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
                <option value="paper">Same as paper</option>
              </select>
            </label>

            <label className="kuraso-field" style={{ flex: 1 }}>
              <span>Answer style</span>
              <select
                className="kuraso-input"
                value={draft.answerStyle}
                onChange={(e) => setDraft({ ...draft, answerStyle: e.target.value as AnswerStyle })}
              >
                <option value="short">Short</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
                <option value="beginner">Explain like I’m a beginner</option>
              </select>
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem" }}>
            <input
              type="checkbox"
              checked={draft.askBeforeCloudSend}
              onChange={(e) => setDraft({ ...draft, askBeforeCloudSend: e.target.checked })}
            />
            <span>Ask before sending a paper to a cloud AI for the first time</span>
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
            {testing ? "Testing…" : "Test connection"}
          </button>
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="kuraso-primary-btn" onClick={handleSave}>
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
