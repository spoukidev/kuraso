import type { ProviderKind, ProviderPreset } from "@kuraso/formats";
import providersFile from "@kuraso/formats/providers";
import type { AnswerLanguage, AnswerStyle, GroundedAnswer } from "@kuraso/ai";

export const PROVIDER_PRESETS: ProviderPreset[] = providersFile.providers as ProviderPreset[];

export interface AISettings {
  enabled: boolean;
  providerId: string;
  kind: ProviderKind;
  label: string;
  baseUrl: string;
  model: string;
  local: boolean;
  answerLanguage: AnswerLanguage;
  answerStyle: AnswerStyle;
  askBeforeCloudSend: boolean;
}

const SETTINGS_KEY = "kuraso:ai-settings:v1";
const SUMMARY_CACHE_PREFIX = "kuraso:ai-summary:v1:";

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  providerId: PROVIDER_PRESETS[0]?.id ?? "google-ai-studio",
  kind: PROVIDER_PRESETS[0]?.kind ?? "openai-compatible",
  label: PROVIDER_PRESETS[0]?.label ?? "Google AI Studio (Gemini Free Tier)",
  baseUrl: PROVIDER_PRESETS[0]?.baseUrl ?? "",
  model: PROVIDER_PRESETS[0]?.defaultModel ?? "",
  local: Boolean(PROVIDER_PRESETS[0]?.local),
  answerLanguage: "en",
  answerStyle: "balanced",
  askBeforeCloudSend: true,
};

/**
 * Models that providers have retired (Groq Llama 3.x, 16 Aug 2026) or closed to new
 * keys (Gemini 2.5, Sept 2026). Saved settings that still point at one of these are
 * moved to the provider's current default so the free tier keeps working.
 */
const RETIRED_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
]);

function migrateRetiredModel(settings: AISettings): AISettings {
  if (!RETIRED_MODELS.has(settings.model)) return settings;
  const preset = PROVIDER_PRESETS.find((p) => p.id === settings.providerId);
  if (!preset?.defaultModel || preset.defaultModel === settings.model) return settings;
  return { ...settings, model: preset.defaultModel };
}

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const merged = { ...DEFAULT_AI_SETTINGS, ...(JSON.parse(raw) as Partial<AISettings>) };
    const migrated = migrateRetiredModel(merged);
    if (migrated !== merged) saveAISettings(migrated);
    return migrated;
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

/** Saves non-secret AI settings only — API keys are NEVER written to localStorage. */
export function saveAISettings(settings: AISettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors.
  }
}

export function loadCachedSummary(paperId: string): GroundedAnswer | null {
  try {
    const raw = localStorage.getItem(`${SUMMARY_CACHE_PREFIX}${paperId}`);
    return raw ? (JSON.parse(raw) as GroundedAnswer) : null;
  } catch {
    return null;
  }
}

export function saveCachedSummary(paperId: string, summary: GroundedAnswer): void {
  try {
    localStorage.setItem(`${SUMMARY_CACHE_PREFIX}${paperId}`, JSON.stringify(summary));
  } catch {
    // Ignore.
  }
}
