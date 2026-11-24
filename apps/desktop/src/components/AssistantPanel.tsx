import { useEffect, useMemo, useRef, useState } from "react";
import type { AIRecipe, Annotation, PaperStructure } from "@kuraso/formats";
import { getAnnotationPage, getAnnotationQuote } from "@kuraso/annotations";
import { exportFlashcardsToAnkiTsv } from "@kuraso/exporters";
import {
  buildPromptMessages,
  buildRecipePrompt,
  buildStudyPrompt,
  parseFlashcards,
  verifyGroundedResponse,
  type AITaskKind,
  type GroundedAnswer,
} from "@kuraso/ai";
import { runChat } from "../state/aiBridge";
import {
  AlertTriangle,
  Send,
  Settings,
  Shield,
  Sparkles,
  Square,
} from "lucide-react";
import {
  loadCachedSummary,
  saveCachedSummary,
  type AISettings,
} from "../state/aiStore";
import { tr } from "../i18n/tr";

interface AssistantPanelProps {
  paperId: string;
  paperTitle: string;
  structure: PaperStructure | null | undefined;
  annotations?: Annotation[];
  scanned: boolean;
  localAiOnly: boolean;
  settings: AISettings;
  apiKey: string;
  /** True when a key is stored for the current provider (keychain or session). */
  keyReady: boolean;
  pendingExplainText: string | null;
  onClearPendingExplain: () => void;
  onOpenSettings: () => void;
  onJumpToPage: (page: number) => void;
  onExportAnki?: (tsv: string) => void;
  recipes?: AIRecipe[];
}

interface ChatTurn {
  id: string;
  label: string;
  answer: GroundedAnswer;
  model: string;
  estimatedTokens: number;
}

function GroundedAnswerView({
  answer,
  paragraphPageMap,
  onJumpToPage,
}: {
  answer: GroundedAnswer;
  paragraphPageMap: Map<string, number>;
  onJumpToPage: (page: number) => void;
}) {
  return (
    <div className="kuraso-ai-answer">
      <div className="kuraso-ai-badge">{tr("AI-generated · cited")}</div>
      {answer.sentences.map((s, idx) => {
        if (s.status === "heading") {
          return (
            <h4 key={idx} dir="auto" style={{ margin: "10px 0 4px", fontSize: "0.86rem" }}>
              {s.text.replace(/^#{1,4}\s+/, "")}
            </h4>
          );
        }
        return (
          <p key={idx} dir="auto" style={{ margin: "4px 0", fontSize: "0.82rem", lineHeight: 1.5 }}>
            <span>{s.text}</span>{" "}
            {s.citations.map((cid) => {
              const page = paragraphPageMap.get(cid) ?? 1;
              return (
                <bdi key={cid}>
                  <button
                    type="button"
                    className="kuraso-cite-chip"
                    title={tr("Jump to {cid} (page {page})", { cid, page })}
                    onClick={() => onJumpToPage(page)}
                  >
                    {cid}
                  </button>
                </bdi>
              );
            })}
            {s.status === "unsupported" && (
              <span
                className="kuraso-unverified-tag"
                title={tr("No valid paragraph citation was provided for this sentence")}
              >
                {tr("unverified")}
              </span>
            )}
          </p>
        );
      })}
    </div>
  );
}

export function AssistantPanel({
  paperId,
  paperTitle,
  structure,
  annotations = [],
  scanned,
  localAiOnly,
  settings,
  apiKey,
  keyReady,
  pendingExplainText,
  onClearPendingExplain,
  onOpenSettings,
  onJumpToPage,
  onExportAnki,
  recipes = [],
}: AssistantPanelProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudConfirmed, setCloudConfirmed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const paragraphs = structure?.paragraphs ?? [];
  const paragraphPageMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of paragraphs) {
      map.set(p.id, p.anchors[0]?.page ?? 1);
    }
    return map;
  }, [paragraphs]);

  useEffect(() => {
    setCloudConfirmed(false);
    setError(null);
    const cached = loadCachedSummary(paperId);
    setTurns(
      cached
        ? [
            {
              id: "cached-summary",
              label: tr("Cached Structured Summary"),
              answer: cached,
              model: settings.model,
              estimatedTokens: 0,
            },
          ]
        : [],
    );
  }, [paperId, settings.model]);

  const blockedByLocalPolicy = localAiOnly && !settings.local;

  async function runTask(task: AITaskKind, extra?: { selection?: string; question?: string }) {
    setError(null);
    if (!settings.enabled) {
      onOpenSettings();
      return;
    }
    if (blockedByLocalPolicy) {
      setError(tr("This paper belongs to a 'Local AI only' collection. Switch to Ollama in Settings."));
      return;
    }
    if (!settings.local && !keyReady) {
      setError(tr("Add your {provider} API key first — it's free and takes a minute.", { provider: settings.label }));
      onOpenSettings();
      return;
    }
    if (scanned || paragraphs.length === 0) {
      setError(tr("No selectable text extracted for this paper yet."));
      return;
    }
    if (!settings.local && settings.askBeforeCloudSend && !cloudConfirmed) {
      setError(
        tr("Confirm below before sending “{title}” text to {provider}.", { title: paperTitle, provider: settings.label }),
      );
      return;
    }

    const built = buildPromptMessages(task, {
      paragraphs,
      selection: extra?.selection ?? "",
      question: extra?.question ?? "",
      language: settings.answerLanguage,
      style: settings.answerStyle,
    });

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);

    try {
      const { text } = await runChat({
        settings,
        sessionApiKey: apiKey,
        messages: built.messages,
        signal: controller.signal,
      });

      const verified = verifyGroundedResponse(
        text,
        paragraphs.map((p) => p.id),
      );

      if (task === "structured-summary") {
        saveCachedSummary(paperId, verified);
      }

      const label =
        task === "tldr"
          ? tr("TL;DR")
          : task === "structured-summary"
            ? tr("Structured Summary")
            : task === "explain-selection"
              ? tr("Explain: “{text}…”", { text: (extra?.selection ?? "").slice(0, 48) })
              : extra?.question ?? tr("Question");

      setTurns((prev) => [
        {
          id: `${Date.now()}`,
          label,
          answer: verified,
          model: settings.model,
          estimatedTokens: built.estimatedInputTokens,
        },
        ...prev,
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tr("AI request failed."));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  async function runStudyTool(mode: "summarize-highlights" | "flashcards") {
    setError(null);
    if (!settings.enabled) {
      onOpenSettings();
      return;
    }
    if (blockedByLocalPolicy) {
      setError(tr("This paper belongs to a 'Local AI only' collection. Switch to Ollama in Settings."));
      return;
    }
    if (!settings.local && !keyReady) {
      setError(tr("Add your {provider} API key first — it's free and takes a minute.", { provider: settings.label }));
      onOpenSettings();
      return;
    }
    if (mode === "summarize-highlights" && annotations.length === 0) {
      setError(tr("Create at least one highlight in this paper first."));
      return;
    }

    const built = buildStudyPrompt(mode, {
      highlights: annotations.map((a) => ({
        quote: getAnnotationQuote(a),
        note: a.note,
        color: a.color,
        label: a.label,
        page: getAnnotationPage(a),
      })),
      paragraphs,
    });

    setRunning(true);
    try {
      const { text } = await runChat({
        settings,
        sessionApiKey: apiKey,
        messages: built.messages,
      });

      if (mode === "flashcards") {
        const cards = parseFlashcards(text);
        if (cards.length > 0 && onExportAnki) {
          onExportAnki(exportFlashcardsToAnkiTsv(cards));
        }
      }

      const verified = verifyGroundedResponse(
        text,
        paragraphs.map((p) => p.id),
      );
      setTurns((prev) => [
        {
          id: `${Date.now()}`,
          label: mode === "flashcards" ? tr("Study Flashcards (Anki)") : tr("Summary of My Highlights"),
          answer: verified,
          model: settings.model,
          estimatedTokens: built.estimatedInputTokens,
        },
        ...prev,
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tr("Study tool failed."));
    } finally {
      setRunning(false);
    }
  }

  async function runRecipe(recipe: AIRecipe) {
    setError(null);
    if (!settings.enabled) {
      onOpenSettings();
      return;
    }
    if (blockedByLocalPolicy) {
      setError(tr("This paper belongs to a 'Local AI only' collection. Switch to Ollama in Settings."));
      return;
    }
    if (!settings.local && !keyReady) {
      setError(tr("Add your {provider} API key first — it's free and takes a minute.", { provider: settings.label }));
      onOpenSettings();
      return;
    }
    if (scanned || paragraphs.length === 0) {
      setError(tr("No selectable text extracted for this paper yet."));
      return;
    }
    const built = buildRecipePrompt(recipe, {
      paragraphs,
      language: settings.answerLanguage,
    });
    setRunning(true);
    try {
      const { text } = await runChat({
        settings,
        sessionApiKey: apiKey,
        messages: built.messages,
      });
      const verified = verifyGroundedResponse(
        text,
        paragraphs.map((p) => p.id),
      );
      setTurns((prev) => [
        {
          id: `${Date.now()}`,
          label: `Recipe: ${recipe.name}`,
          answer: verified,
          model: settings.model,
          estimatedTokens: built.estimatedInputTokens,
        },
        ...prev,
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tr("Recipe run failed."));
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (pendingExplainText) {
      const text = pendingExplainText;
      onClearPendingExplain();
      void runTask("explain-selection", { selection: text });
    }
  }, [pendingExplainText]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", fontWeight: 500 }}>
          <Sparkles size={14} />
          <span dir="ltr">{settings.enabled ? settings.model || settings.label : tr("AI Off")}</span>
        </div>
        <button type="button" className="kuraso-icon-btn" title={tr("AI Settings")} onClick={onOpenSettings}>
          <Settings size={14} />
        </button>
      </div>

      {blockedByLocalPolicy && (
        <div className="kuraso-info-box" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Shield size={14} />
          <span>{tr("Local AI only collection — cloud providers are blocked.")}</span>
        </div>
      )}

      {settings.enabled && !settings.local && settings.askBeforeCloudSend && !cloudConfirmed && (
        <div className="kuraso-info-box">
          <div>
            {tr("Paragraphs from this paper will be sent to")} <strong>{settings.label}</strong>.
          </div>
          <button
            type="button"
            className="kuraso-chip"
            data-active="true"
            style={{ marginBlockStart: 6 }}
            onClick={() => {
              setCloudConfirmed(true);
              setError(null);
            }}
          >
            {tr("Allow for this paper")}
          </button>
        </div>
      )}

      {/* Quick grounded actions */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          className="kuraso-chip"
          disabled={running}
          onClick={() => void runTask("tldr")}
        >
          {tr("TL;DR")}
        </button>
        <button
          type="button"
          className="kuraso-chip"
          disabled={running}
          onClick={() => void runTask("structured-summary")}
        >
          {tr("Structured Summary")}
        </button>
        <button
          type="button"
          className="kuraso-chip"
          disabled={running}
          onClick={() => void runStudyTool("summarize-highlights")}
        >
          {tr("Summarize Highlights")}
        </button>
        <button
          type="button"
          className="kuraso-chip"
          disabled={running}
          onClick={() => void runStudyTool("flashcards")}
        >
          {tr("Anki Flashcards")}
        </button>
        {recipes.length > 0 && (
          <select
            className="kuraso-input"
            style={{ fontSize: "0.74rem", paddingBlock: 2 }}
            aria-label={tr("Run AI recipe")}
            defaultValue=""
            disabled={running}
            onChange={(e) => {
              const r = recipes.find((rec) => rec.id === e.target.value);
              e.target.value = "";
              if (r) void runRecipe(r);
            }}
          >
            <option value="" disabled>
              {tr("Run Recipe…")}
            </option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.builtIn ? tr(r.name) : r.name}
              </option>
            ))}
          </select>
        )}
        {running && (
          <button
            type="button"
            className="kuraso-chip"
            style={{ borderColor: "var(--kuraso-hl-red-border)", color: "var(--kuraso-hl-red-border)" }}
            onClick={() => abortRef.current?.abort()}
          >
            <Square size={10} /> {tr("Stop")}
          </button>
        )}
      </div>

      {/* Chat input */}
      <form
        style={{ display: "flex", gap: 6 }}
        onSubmit={(e) => {
          e.preventDefault();
          const q = question.trim();
          if (!q || running) return;
          setQuestion("");
          void runTask("chat", { question: q });
        }}
      >
        <input
          className="kuraso-input"
          dir="auto"
          style={{ flex: 1, minWidth: 0, fontSize: "0.8rem" }}
          placeholder={tr("Ask about this paper…")}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="submit"
          className="kuraso-primary-btn"
          style={{ paddingInline: 10, paddingBlock: 6 }}
          disabled={running || !question.trim()}
          title={tr("Ask")}
        >
          <Send size={13} />
        </button>
      </form>

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            fontSize: "0.78rem",
            color: "var(--kuraso-hl-red-border)",
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginBlockStart: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Grounded answers feed */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {turns.length === 0 && !running && (
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--kuraso-text-muted)", lineHeight: 1.5 }}>
            {settings.enabled
              ? tr("Click TL;DR, Structured Summary, select any passage and press Ctrl+E, or ask a question. Every sentence cites a verified [P#] paragraph.")
              : tr("Connect a free-tier API key (no credit card needed) or local Ollama in Settings to summarize and ask grounded questions.")}
          </p>
        )}
        {running && (
          <div style={{ fontSize: "0.8rem", color: "var(--kuraso-text-muted)" }}>
            {tr("Generating grounded answer…")}
          </div>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="kuraso-ann-card">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "var(--kuraso-text-muted)" }}>
              <strong dir="auto">{turn.label}</strong>
              {turn.estimatedTokens > 0 && <span>~{turn.estimatedTokens} tok</span>}
            </div>
            <GroundedAnswerView
              answer={turn.answer}
              paragraphPageMap={paragraphPageMap}
              onJumpToPage={onJumpToPage}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
