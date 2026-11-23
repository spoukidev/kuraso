import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { TRANSLATIONS, type UILanguage } from "../i18n/translations.mjs";

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
      <div className="kuraso-dialog kuraso-onboarding">
        <div className="kuraso-onboarding-hero">
          <div className="kuraso-onboarding-hero-top">
            <div className="kuraso-brand">
              <span className="kuraso-brand-tile" aria-hidden="true">
                k
              </span>
              <span className="kuraso-brand-word">kuraso</span>
            </div>
            <span className="kuraso-onboarding-hand" aria-hidden="true">
              read · mark · keep
            </span>
          </div>
          <h2 className="kuraso-onboarding-title" dir="auto">
            {t.onboardingTitle}
          </h2>
          <p className="kuraso-onboarding-sub" dir="auto">
            {t.onboardingSubtitle}
          </p>
        </div>

        <div className="kuraso-dialog-body" style={{ maxHeight: "56vh", overflowY: "auto" }}>
          <div className="kuraso-field">
            <span>{t.chooseLanguage}</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
              <button
                type="button"
                className="kuraso-chip"
                data-active={language === "ar" ? "true" : "false"}
                onClick={() => onLanguageChange("ar")}
              >
                العربية (RTL)
              </button>
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
                      {selected && <Check size={16} strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--kuraso-text-secondary)" }}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {aiChoice === "local" && isLowRam && (
            <div className="kuraso-banner-warning" style={{ borderRadius: 10, border: "1.5px dashed var(--kuraso-hl-yellow-border)" }}>
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
