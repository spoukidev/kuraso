import { useState, type ReactNode } from "react";
import type { BacklinkEntry } from "@kuraso/annotations";
import { Link2 } from "lucide-react";
import { tr } from "../i18n/tr";

interface NotesEditorProps {
  markdown: string;
  onChange: (next: string) => void;
  backlinks?: BacklinkEntry[];
  onFollowWikiLink?: (targetTitle: string) => void;
  onOpenBacklinkSource?: (sourceId: string) => void;
}

type Follow = ((target: string) => void) | undefined;

/**
 * Inline Markdown: `code`, **bold**, *italic* / _italic_, ~~strike~~, [text](url) and
 * [[wiki-links]]. Built as React elements (never HTML strings), so note text cannot
 * inject markup. Links are shown, not followed: navigating would replace the app.
 */
function renderInline(text: string, onFollow: Follow, keyBase = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  const re =
    /(`[^`]+`)|(\[\[[^\]|]+?(?:\|[^\]]+)?\]\])|(\*\*[^*]+\*\*|__[^_]+__)|(~~[^~]+~~)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)\s]+\))/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${k++}`;
    if (m[1]) {
      out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    } else if (m[2]) {
      const inner = tok.slice(2, -2);
      const [target = "", label] = inner.split("|");
      out.push(
        <button key={key} type="button" className="kuraso-wikilink" onClick={() => onFollow?.(target.trim())}>
          [[{(label ?? target).trim()}]]
        </button>,
      );
    } else if (m[3]) {
      out.push(<strong key={key}>{renderInline(tok.slice(2, -2), onFollow, key)}</strong>);
    } else if (m[4]) {
      out.push(<del key={key}>{renderInline(tok.slice(2, -2), onFollow, key)}</del>);
    } else if (m[5]) {
      out.push(<em key={key}>{renderInline(tok.slice(1, -1), onFollow, key)}</em>);
    } else if (m[6]) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      out.push(
        <span key={key} className="kuraso-md-link" title={lm?.[2]}>
          {renderInline(lm?.[1] ?? tok, onFollow, key)}
        </span>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isTableRule = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l: string) =>
  l
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

/**
 * Pure React Markdown preview (zero dangerouslySetInnerHTML): headings, lists (- * + and
 * 1.), quotes, fenced code, tables, rules and paragraphs, each block with `dir="auto"`.
 */
function SafeMarkdownPreview({ markdown, onFollowWikiLink }: { markdown: string; onFollowWikiLink?: Follow }) {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const inline = (t: string) => renderInline(t, onFollowWikiLink, `b${key}`);

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) body.push(lines[i++] ?? "");
      i++;
      blocks.push(
        <pre key={key++} className="kuraso-md-code" dir="ltr">
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = Math.min(4, (heading[1] ?? "#").length + 1);
      const Tag = `h${level}` as "h2" | "h3" | "h4";
      blocks.push(
        <Tag key={key++} dir="auto">
          {inline(heading[2] ?? "")}
        </Tag>,
      );
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }
    if (isTableRow(line) && isTableRule(lines[i + 1] ?? "")) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i] ?? "")) rows.push(cells(lines[i++] ?? ""));
      blocks.push(
        <div key={key++} className="kuraso-md-table-wrap">
          <table className="kuraso-md-table">
            <thead>
              <tr>
                {head.map((c, ci) => (
                  <th key={ci} dir="auto">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {head.map((_, ci) => (
                    <td key={ci} dir="auto">
                      {inline(r[ci] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^([-*+]|\d+[.)])\s+/.test(trimmed)) {
      const ordered = /^\d+[.)]\s+/.test(trimmed);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/).test(lines[i] ?? "")) {
        items.push((lines[i++] ?? "").trim().replace(/^([-*+]|\d+[.)])\s+/, ""));
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key++} dir="auto">
          {items.map((it, ii) => {
            const task = /^\[( |x|X)\]\s+(.*)$/.exec(it);
            return (
              <li key={ii}>
                {task ? (
                  <>
                    <input type="checkbox" checked={task[1] !== " "} readOnly /> {inline(task[2] ?? "")}
                  </>
                ) : (
                  inline(it)
                )}
              </li>
            );
          })}
        </List>,
      );
      continue;
    }
    if (trimmed.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) quote.push((lines[i++] ?? "").trim().replace(/^>\s?/, ""));
      blocks.push(
        <blockquote key={key++} dir="auto" className="kuraso-ann-quote">
          {inline(quote.join(" "))}
        </blockquote>,
      );
      continue;
    }
    // Paragraph: consecutive plain lines.
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? "";
      const t = l.trim();
      if (!t || /^(#{1,6}\s|```|>|([-*+]|\d+[.)])\s)/.test(t) || (isTableRow(l) && isTableRule(lines[i + 1] ?? ""))) break;
      para.push(t);
      i++;
    }
    blocks.push(
      <p key={key++} dir="auto">
        {inline(para.join(" "))}
      </p>,
    );
  }

  return <div className="kuraso-md-preview">{blocks}</div>;
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
            {tr("Edit")}
          </button>
          <button
            type="button"
            className="kuraso-chip"
            data-active={mode === "preview" ? "true" : "false"}
            onClick={() => setMode("preview")}
          >
            {tr("Preview")}
          </button>
        </div>
      </div>

      {mode === "edit" ? (
        <textarea
          className="kuraso-notes-textarea"
          dir="auto"
          placeholder={tr("Write Markdown notes (supports [[Paper Title]] wiki-links)…")}
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
            <span>{tr("Backlinks ({n})", { n: backlinks.length })}</span>
          </div>
          {backlinks.map((b) => (
            <button
              key={b.sourceId}
              type="button"
              className="kuraso-outline-item"
              style={{ paddingInline: 4, fontSize: "0.76rem" }}
              onClick={() => onOpenBacklinkSource?.(b.sourceId)}
            >
              <bdi dir="auto">{b.sourceTitle}</bdi>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
