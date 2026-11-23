import { useState } from "react";
import type { PaperMeta } from "@kuraso/formats";
import { buildCollectionPrompt, callProviderChat } from "@kuraso/ai";
import { AlertTriangle, Sparkles, Table2, X } from "lucide-react";
import type { AISettings } from "../state/aiStore";

interface CollectionToolsModalProps {
  open: boolean;
  collectionName: string;
  papers: PaperMeta[];
  localAiOnly: boolean;
  settings: AISettings;
  apiKey: string;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function CollectionToolsModal({
  open,
  collectionName,
  papers,
  localAiOnly,
  settings,
  apiKey,
  onClose,
  onOpenSettings,
}: CollectionToolsModalProps) {
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [estTokens, setEstTokens] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const blocked = localAiOnly && !settings.local;

  async function run(mode: "comparison-table" | "collection-chat") {
    setError(null);
    if (!settings.enabled) {
      onOpenSettings();
      return;
    }
    if (blocked) {
      setError("This collection is marked 'Local AI only'. Switch to Ollama in Settings.");
      return;
    }
    if (papers.length === 0) {
      setError("Add papers to this view first.");
      return;
    }

    const built = buildCollectionPrompt(mode, {
      papers: papers.slice(0, 15).map((p) => ({
        id: p.id,
        title: p.title,
        year: p.year,
        abstract: p.abstract,
      })),
      question,
      language: settings.answerLanguage,
    });
    setEstTokens(built.estimatedInputTokens);
    setRunning(true);
    try {
      const { text } = await callProviderChat({
        kind: settings.kind,
        baseUrl: settings.baseUrl,
        apiKey: settings.local ? undefined : apiKey,
        model: settings.model,
        messages: built.messages,
      });
      setOutput(text);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Collection AI request failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      className="kuraso-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Multi-Paper AI Tools"
      onClick={onClose}
    >
      <div className="kuraso-dialog" style={{ width: "min(680px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
        <div className="kuraso-dialog-header">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Table2 size={16} />
            <strong>
              Multi-Paper AI · {collectionName} ({papers.length})
            </strong>
          </div>
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="kuraso-dialog-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="kuraso-primary-btn"
              disabled={running || papers.length === 0}
              onClick={() => void run("comparison-table")}
            >
              <Table2 size={14} />
              <span>Generate Comparison Table</span>
            </button>
            {estTokens > 0 && (
              <span style={{ fontSize: "0.76rem", color: "var(--kuraso-text-muted)" }}>
                ~{estTokens} input tokens
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="kuraso-input"
              dir="auto"
              style={{ flex: 1 }}
              placeholder="Ask across all papers in this view (e.g. How do they evaluate robustness?)…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && question.trim()) void run("collection-chat");
              }}
            />
            <button
              type="button"
              className="kuraso-icon-btn"
              disabled={running || !question.trim()}
              onClick={() => void run("collection-chat")}
            >
              <Sparkles size={14} />
              <span>Ask</span>
            </button>
          </div>

          {error && (
            <div style={{ display: "flex", gap: 6, fontSize: "0.8rem", color: "var(--kuraso-hl-red-border)" }}>
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          {running && (
            <div style={{ fontSize: "0.82rem", color: "var(--kuraso-text-muted)" }}>
              Analyzing {Math.min(papers.length, 15)} papers…
            </div>
          )}

          {output && (
            <div className="kuraso-ann-card">
              <div className="kuraso-ai-badge">AI-generated · Multi-Paper Grounded</div>
              <pre
                dir="auto"
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--kuraso-font-mono)",
                  fontSize: "0.78rem",
                  lineHeight: 1.5,
                }}
              >
                {output}
              </pre>
            </div>
          )}
        </div>

        <div className="kuraso-dialog-footer">
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
