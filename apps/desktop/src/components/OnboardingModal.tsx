import { useState } from "react";
import { AlertTriangle, BookOpen, Check } from "lucide-react";
import { TRANSLATIONS, type UILanguage } from "../i18n/translations";

export type OnboardingAIChoice = "free-cloud" | "paid" | "university" | "local" | "none";

interface OnboardingModalProps {
  open: boolean;
  language: UILanguage;
  onLanguageChange: (lang: UILanguage) => void;
  onComplete: (choice: OnboardingAIChoice) => void;
}

export function OnboardingModal({
  open,
  language,
  onLanguageChange,
  onComplete,
}: OnboardingModalProps) {
  const [aiChoice, setAiChoice] = useState<OnboardingAIChoice>("free-cloud");

  if (!open) return null;

  const t = TRANSLATIONS[language];
  const deviceMemoryGb =
    typeof navigator !== "undefined" && "deviceMemory" in navigator
      ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0)
      : 0;
  const isLowRam = deviceMemoryGb > 0 && deviceMemoryGb < 8;

  const options: { id: OnboardingAIChoice; title: string; desc: string }[] = [
    { id: "free-cloud", title: t.freeAiOption, desc: t.freeAiDesc },
    { id: "paid", title: t.paidAiOption, desc: t.paidAiDesc },
    { id: "university", title: t.univAiOption, desc: t.univAiDesc },
    { id: "local", title: t.localAiOption, desc: t.localAiDesc },
    { id: "none", title: t.noAiOption, desc: t.noAiDesc },
  ];

  return (
    <div className="kuraso-modal-backdrop" role="dialog" aria-modal="true" aria-label={t.onboardingTitle}>
      <div className="kuraso-dialog" style={{ width: "min(560px, 94vw)" }}>
        <div className="kuraso-dialog-header">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={18} />
            <strong>{t.onboardingTitle}</strong>
          </div>
          <span style={{ fontSize: "0.74rem", color: "var(--kuraso-text-muted)" }}>v0.1 Alpha</span>
        </div>

        <div className="kuraso-dialog-body" style={{ maxHeight: "74vh", overflowY: "auto" }}>
          <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--kuraso-text-secondary)" }}>
            {t.onboardingSubtitle}
          </p>

          <div className="kuraso-field">
            <span>{t.chooseLanguage}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="kuraso-chip"
                data-active={language === "en" ? "true" : "false"}
                onClick={() => onLanguageChange("en")}
              >
                English
              </button>
              <button
                type="button"
                className="kuraso-chip"
                data-active={language === "fr" ? "true" : "false"}
                onClick={() => onLanguageChange("fr")}
              >
                Français
              </button>
              <span className="kuraso-chip" style={{ opacity: 0.55, cursor: "default" }}>
                العربية (v0.2 RTL)
              </span>
            </div>
          </div>

          <div className="kuraso-field">
            <span>{t.chooseAiMode}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {options.map((opt) => {
                const selected = aiChoice === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className="kuraso-onboarding-option"
                    data-active={selected ? "true" : "false"}
                    onClick={() => setAiChoice(opt.id)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{opt.title}</strong>
                      {selected && <Check size={14} />}
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "var(--kuraso-text-secondary)" }}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {aiChoice === "local" && isLowRam && (
            <div className="kuraso-banner-warning" style={{ borderRadius: 6, border: "1px solid var(--kuraso-hl-yellow-border)" }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{t.lowRamWarning}</span>
            </div>
          )}
        </div>

        <div className="kuraso-dialog-footer">
          <button
            type="button"
            className="kuraso-primary-btn"
            onClick={() => onComplete(aiChoice)}
          >
            {t.finishSetup}
          </button>
        </div>
      </div>
    </div>
  );
}
