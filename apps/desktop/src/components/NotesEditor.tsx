import { useState, type ReactNode } from "react";
import type { BacklinkEntry } from "@kuraso/annotations";
import { Link2 } from "lucide-react";

interface NotesEditorProps {
  markdown: string;
  onChange: (next: string) => void;
  backlinks?: BacklinkEntry[];
  onFollowWikiLink?: (targetTitle: string) => void;
  onOpenBacklinkSource?: (sourceId: string) => void;
}

function renderInlineWikiLinks(
  text: string,
  onFollow?: (target: string) => void,
): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(text.slice(lastIdx, m.index));
    }
    const target = (m[1] ?? "").trim();
    const label = (m[2] ?? target).trim();
    parts.push(
      <button
        key={`wl-${key++}`}
        type="button"
        className="kuraso-wikilink"
        onClick={() => onFollow?.(target)}
      >
        [[{label}]]
      </button>,
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}

/**
 * Pure React Markdown preview (zero dangerouslySetInnerHTML) with `dir="auto"`
 * per block and clickable `[[wiki-links]]`.
 */
function SafeMarkdownPreview({
  markdown,
  onFollowWikiLink,
}: {
  markdown: string;
  onFollowWikiLink?: (target: string) => void;
}) {
  const lines = markdown.split(/\r?\n/);

  return (
    <div className="kuraso-md-preview">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: 8 }} />;
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} dir="auto" style={{ margin: "10px 0 4px" }}>
              {renderInlineWikiLinks(trimmed.slice(4), onFollowWikiLink)}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} dir="auto" style={{ margin: "12px 0 4px" }}>
              {renderInlineWikiLinks(trimmed.slice(3), onFollowWikiLink)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} dir="auto" style={{ margin: "12px 0 6px", fontSize: "1.05rem" }}>
              {renderInlineWikiLinks(trimmed.slice(2), onFollowWikiLink)}
            </h2>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} dir="auto" style={{ paddingInlineStart: 12 }}>
              • {renderInlineWikiLinks(trimmed.slice(2), onFollowWikiLink)}
            </div>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={idx} dir="auto" className="kuraso-ann-quote">
              {renderInlineWikiLinks(trimmed.slice(2), onFollowWikiLink)}
            </blockquote>
          );
        }
        return (
          <p key={idx} dir="auto" style={{ margin: "4px 0", lineHeight: 1.55 }}>
            {renderInlineWikiLinks(trimmed, onFollowWikiLink)}
          </p>
        );
      })}
    </div>
  );
}

export function NotesEditor({
  markdown,
  onChange,
  backlinks = [],
  onFollowWikiLink,
  onOpenBacklinkSource,
}: NotesEditorProps) {
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
          placeholder="Write Markdown notes (supports [[Paper Title]] wiki-links)…"
          value={markdown}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <SafeMarkdownPreview markdown={markdown} onFollowWikiLink={onFollowWikiLink} />
      )}

      {backlinks.length > 0 && (
        <div className="kuraso-info-box">
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600, marginBlockEnd: 4 }}>
            <Link2 size={12} />
            <span>Backlinks ({backlinks.length})</span>
          </div>
          {backlinks.map((b) => (
            <button
              key={b.sourceId}
              type="button"
              className="kuraso-outline-item"
              style={{ paddingInline: 4, fontSize: "0.76rem" }}
              onClick={() => onOpenBacklinkSource?.(b.sourceId)}
            >
              <span>{b.sourceTitle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
