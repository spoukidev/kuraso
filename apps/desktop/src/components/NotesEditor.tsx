import { useState } from "react";

interface NotesEditorProps {
  markdown: string;
  onChange: (next: string) => void;
}

/**
 * Pure React Markdown preview (zero dangerouslySetInnerHTML) with `dir="auto"`
 * per block so mixed Arabic/English academic notes render cleanly and safely.
 */
function SafeMarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);

  return (
    <div className="kuraso-md-preview">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: 8 }} />;
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} dir="auto" style={{ margin: "10px 0 4px" }}>
              {trimmed.slice(4)}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} dir="auto" style={{ margin: "12px 0 4px" }}>
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} dir="auto" style={{ margin: "12px 0 6px", fontSize: "1.05rem" }}>
              {trimmed.slice(2)}
            </h2>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} dir="auto" style={{ paddingInlineStart: 12 }}>
              • {trimmed.slice(2)}
            </div>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={idx} dir="auto" className="kuraso-ann-quote">
              {trimmed.slice(2)}
            </blockquote>
          );
        }
        return (
          <p key={idx} dir="auto" style={{ margin: "4px 0", lineHeight: 1.55 }}>
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export function NotesEditor({ markdown, onChange }: NotesEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.76rem", color: "var(--kuraso-text-muted)", fontFamily: "var(--kuraso-font-mono)" }}>
          notes.md
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            className="kuraso-chip"
            data-active={mode === "edit" ? "true" : "false"}
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            className="kuraso-chip"
            data-active={mode === "preview" ? "true" : "false"}
            onClick={() => setMode("preview")}
          >
            Preview
          </button>
        </div>
      </div>

      {mode === "edit" ? (
        <textarea
          className="kuraso-notes-textarea"
          dir="auto"
          placeholder="Write Markdown notes for this paper (Obsidian-compatible)…"
          value={markdown}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <SafeMarkdownPreview markdown={markdown} />
      )}
    </div>
  );
}
