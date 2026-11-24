import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Annotation,
  AnnotationType,
  HighlightColor,
  Paragraph,
  PaperStructure,
  PdfAnchor,
} from "@kuraso/formats";
import { createAnnotation, getAnnotationPage, getAnnotationQuote, SEMANTIC_LABELS } from "@kuraso/annotations";
import { SEMANTIC_HIGHLIGHT_DEFAULTS } from "@kuraso/ui";
import { Eye, Minus, Plus, Strikethrough, Underline, X } from "lucide-react";
import { tr } from "../i18n/tr";

const HIGHLIGHT_COLORS: HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

interface CleanReadingViewProps {
  title: string;
  structure: PaperStructure | null | undefined;
  annotations: Annotation[];
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onExitCleanMode: () => void;
  /** Side-by-side with the PDF: no big title, follow the PDF's current page. */
  compact?: boolean;
  currentPage?: number;
  onJumpToPage?: (page: number) => void;
  onCreateAnnotation?: (ann: Annotation, focusNotes?: boolean) => void;
  onExplainSelection?: (text: string) => void;
  /** View switch / full-screen controls rendered at the end of the toolbar. */
  toolbarExtra?: ReactNode;
}

// ── Text model ───────────────────────────────────────────────────────────────
// Annotations are matched on text with whitespace ignored, so quotes made on the PDF
// (line breaks, hyphen joins, older glued quotes) find their place in reflowed paragraphs.

interface Stream {
  chars: string;
  para: Int32Array;
  off: Int32Array;
}

function buildStream(paragraphs: Paragraph[]): Stream {
  let total = 0;
  for (const p of paragraphs) total += p.text.length;
  const para = new Int32Array(total);
  const off = new Int32Array(total);
  const chars: string[] = [];
  let n = 0;
  paragraphs.forEach((p, pi) => {
    const t = p.text;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i] ?? "";
      if (/\s/.test(ch)) continue;
      chars.push(ch.toLowerCase());
      para[n] = pi;
      off[n] = i;
      n++;
    }
  });
  return { chars: chars.join(""), para: para.subarray(0, n), off: off.subarray(0, n) };
}

interface Segment {
  start: number;
  end: number;
  ann: Annotation;
}

function mapHighlights(paragraphs: Paragraph[], stream: Stream, annotations: Annotation[]): Map<number, Segment[]> {
  const byPara = new Map<number, Segment[]>();
  for (const ann of annotations) {
    const target = getAnnotationQuote(ann).replace(/\s+/g, "").toLowerCase();
    if (target.length < 3) continue;
    const wantPage = getAnnotationPage(ann);
    let pick = -1;
    for (let i = stream.chars.indexOf(target); i !== -1; i = stream.chars.indexOf(target, i + 1)) {
      if (pick === -1) pick = i;
      const p = paragraphs[stream.para[i] ?? 0];
      if (p?.anchors[0]?.page === wantPage || p?.id === ann.target.paragraph) {
        pick = i;
        break;
      }
    }
    if (pick === -1) continue;
    const last = pick + target.length - 1;
    const p0 = stream.para[pick] ?? 0;
    const p1 = stream.para[last] ?? p0;
    for (let pi = p0; pi <= p1; pi++) {
      const text = paragraphs[pi]?.text ?? "";
      const start = pi === p0 ? (stream.off[pick] ?? 0) : 0;
      const end = pi === p1 ? (stream.off[last] ?? 0) + 1 : text.length;
      const list = byPara.get(pi) ?? [];
      list.push({ start, end, ann });
      byPara.set(pi, list);
    }
  }
  for (const list of byPara.values()) list.sort((a, b) => a.start - b.start);
  return byPara;
}

/** PDF rectangles covering characters [s, e) of a paragraph, one per line run. */
function anchorsForRange(p: Paragraph, s: number, e: number): PdfAnchor[] {
  const pieces: PdfAnchor[] = [];
  let cursor = 0;
  for (const a of p.anchors) {
    if (!a.text) continue;
    const t = a.text.replace(/\s+/g, " ").trim();
    const at = p.text.indexOf(t, cursor);
    if (at < 0 || t.length === 0) continue;
    cursor = at + t.length;
    const ls = Math.max(s, at);
    const le = Math.min(e, at + t.length);
    if (le <= ls) continue;
    const [x1, y1, x2, y2] = a.rect;
    const w = x2 - x1;
    pieces.push({
      page: a.page,
      rect: [x1 + (w * (ls - at)) / t.length, y1, x1 + (w * (le - at)) / t.length, y2],
    });
  }
  // Merge runs that sit on the same line into one rectangle.
  const merged: PdfAnchor[] = [];
  for (const piece of pieces) {
    const prev = merged[merged.length - 1];
    const h = piece.rect[3] - piece.rect[1];
    if (
      prev &&
      prev.page === piece.page &&
      Math.abs(prev.rect[1] - piece.rect[1]) < h * 0.35 &&
      piece.rect[0] - prev.rect[2] < h * 1.6 &&
      piece.rect[0] >= prev.rect[0]
    ) {
      prev.rect = [prev.rect[0], Math.min(prev.rect[1], piece.rect[1]), Math.max(prev.rect[2], piece.rect[2]), Math.max(prev.rect[3], piece.rect[3])];
    } else {
      merged.push({ page: piece.page, rect: [...piece.rect] as PdfAnchor["rect"] });
    }
  }
  return merged;
}

/** Where a DOM selection boundary falls in paragraph-character terms. */
function locate(node: Node, offset: number, atEnd: boolean): { pi: number; off: number } | null {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  const pEl = el?.closest<HTMLElement>("[data-pidx]");
  if (!el || !pEl) return null;
  const pi = Number(pEl.dataset.pidx);
  const len = Number(pEl.dataset.len);
  if (el.closest("[data-skip]")) return { pi, off: atEnd ? len : 0 };
  const piece = el.closest<HTMLElement>("[data-off]");
  if (node.nodeType === Node.TEXT_NODE && piece) return { pi, off: Number(piece.dataset.off) + offset };
  // Boundary on an element: before/after its children.
  return { pi, off: offset === 0 && !atEnd ? 0 : len };
}

interface PendingReflowSelection {
  exact: string;
  anchors: PdfAnchor[];
  paragraphId: string | null;
  x: number;
  y: number;
}

function ParagraphText({ text, segments }: { text: string; segments: Segment[] | undefined }) {
  if (!segments || segments.length === 0) return <span data-off={0}>{text}</span>;
  const out: ReactNode[] = [];
  let pos = 0;
  segments.forEach((seg, i) => {
    const start = Math.max(seg.start, pos);
    if (start >= seg.end) return;
    if (start > pos) out.push(<span key={`t${i}`} data-off={pos}>{text.slice(pos, start)}</span>);
    const style = SEMANTIC_HIGHLIGHT_DEFAULTS[seg.ann.color];
    const isUnderline = seg.ann.type === "underline";
    const isStrike = seg.ann.type === "strikethrough";
    out.push(
      <mark
        key={`m${i}`}
        data-off={start}
        style={{
          backgroundColor: isUnderline || isStrike ? "transparent" : style.cssBg,
          textDecoration: isUnderline ? `underline 2px ${style.cssBorder}` : isStrike ? `line-through 2px ${style.cssBorder}` : undefined,
        }}
      >
        {text.slice(start, seg.end)}
      </mark>,
    );
    pos = seg.end;
  });
  if (pos < text.length) out.push(<span key="tail" data-off={pos}>{text.slice(pos)}</span>);
  return <>{out}</>;
}

export function CleanReadingView({
  title,
  structure,
  annotations,
  focusMode,
  onToggleFocusMode,
  onExitCleanMode,
  compact = false,
  currentPage,
  onJumpToPage,
  onCreateAnnotation,
  onExplainSelection,
  toolbarExtra,
}: CleanReadingViewProps) {
  const [fontSize, setFontSize] = useState(compact ? 15 : 17);
  const [pending, setPending] = useState<PendingReflowSelection | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const userScrollAt = useRef(0);

  const paragraphs = useMemo(() => structure?.paragraphs ?? [], [structure]);
  const stream = useMemo(() => buildStream(paragraphs), [paragraphs]);
  const highlights = useMemo(() => mapHighlights(paragraphs, stream, annotations), [paragraphs, stream, annotations]);

  const headingsByParagraph = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of structure?.headings ?? []) {
      if (h.paragraphId && !map.has(h.paragraphId)) map.set(h.paragraphId, h.title);
    }
    return map;
  }, [structure]);

  // Side by side: keep the reflow on the page the PDF shows, unless the reader is scrolling here.
  useEffect(() => {
    if (!compact || !currentPage || !articleRef.current) return;
    if (Date.now() - userScrollAt.current < 1500) return;
    const idx = paragraphs.findIndex((p) => (p.anchors[0]?.page ?? 1) >= currentPage);
    if (idx < 0) return;
    articleRef.current
      .querySelector(`[data-pidx="${idx}"]`)
      ?.closest(".kuraso-clean-block")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [compact, currentPage, paragraphs]);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const a = locate(range.startContainer, range.startOffset, false);
    const b = locate(range.endContainer, range.endOffset, true);
    if (!a || !b) return;
    const parts: string[] = [];
    const anchors: PdfAnchor[] = [];
    for (let pi = a.pi; pi <= b.pi; pi++) {
      const p = paragraphs[pi];
      if (!p) continue;
      const s = pi === a.pi ? a.off : 0;
      const e = pi === b.pi ? b.off : p.text.length;
      if (e <= s) continue;
      parts.push(p.text.slice(s, e));
      anchors.push(...anchorsForRange(p, s, e));
    }
    const exact = parts.join(" ").replace(/\s+/g, " ").trim();
    if (exact.length < 2) return;
    const rect = range.getBoundingClientRect();
    setPending({
      exact,
      anchors,
      paragraphId: paragraphs[a.pi]?.id ?? null,
      x: rect.left + rect.width / 2,
      y: Math.max(54, rect.top - 46),
    });
  }, [paragraphs]);

  const commit = useCallback(
    (color: HighlightColor, type: AnnotationType = "highlight", focusNotes = false) => {
      if (!pending || !onCreateAnnotation) return;
      onCreateAnnotation(
        createAnnotation({ type, color, exact: pending.exact, anchors: pending.anchors, paragraph: pending.paragraphId }),
        focusNotes,
      );
      window.getSelection()?.removeAllRanges();
      setPending(null);
    },
    [pending, onCreateAnnotation],
  );

  // Same keys as the PDF: 1–5 colours, N note, Ctrl+E explain, Esc cancel.
  useEffect(() => {
    if (!pending) return;
    const active = pending;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        commit(HIGHLIGHT_COLORS[Number(e.key) - 1] ?? "yellow");
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        commit("yellow", "highlight", true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e" && onExplainSelection) {
        e.preventDefault();
        onExplainSelection(active.exact);
        setPending(null);
      } else if (e.key === "Escape") {
        setPending(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, commit, onExplainSelection]);

  if (!structure || paragraphs.length === 0) {
    return (
      <div className="kuraso-empty-state">
        <p>{tr("Clean Reading Mode requires extracted text paragraphs from this PDF.")}</p>
        <button type="button" className="kuraso-primary-btn" onClick={onExitCleanMode}>
          {tr("Return to Original PDF")}
        </button>
      </div>
    );
  }

  return (
    <div className="kuraso-reflow" data-compact={compact ? "true" : "false"}>
      <div className="kuraso-reader-toolbar">
        <div className="kuraso-reader-toolbar-group">
          <strong>{tr("Reflow")}</strong>
          {!compact && (
            <span style={{ color: "var(--kuraso-text-muted)" }}>
              · {tr("{n} paragraphs", { n: paragraphs.length })}
            </span>
          )}
        </div>

        <div className="kuraso-reader-toolbar-group">
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Decrease reading font size")}
            onClick={() => setFontSize((s) => Math.max(12, s - 1))}
          >
            <Minus size={14} />
          </button>
          <span dir="ltr" style={{ minWidth: 38, textAlign: "center" }}>{fontSize}px</span>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Increase reading font size")}
            onClick={() => setFontSize((s) => Math.min(26, s + 1))}
          >
            <Plus size={14} />
          </button>
          {!compact && (
            <button
              type="button"
              className="kuraso-icon-btn"
              data-active={focusMode ? "true" : "false"}
              title={tr("Focus mode (F11)")}
              onClick={onToggleFocusMode}
            >
              <Eye size={14} />
              <span>{tr("Focus")}</span>
            </button>
          )}
          {toolbarExtra}
        </div>
      </div>

      {pending && onCreateAnnotation && (
        <div
          className="kuraso-selection-toolbar"
          style={{ left: pending.x, top: pending.y }}
          role="toolbar"
          aria-label={tr("Highlight selection")}
          onMouseDown={(e) => e.preventDefault()}
        >
          {HIGHLIGHT_COLORS.map((c, idx) => (
            <button
              key={c}
              type="button"
              className="kuraso-color-dot"
              title={tr("{label} (key {n})", { label: tr(SEMANTIC_LABELS[c]), n: idx + 1 })}
              style={{ backgroundColor: SEMANTIC_HIGHLIGHT_DEFAULTS[c].cssMarker }}
              onClick={() => commit(c)}
            >
              {idx + 1}
            </button>
          ))}
          <span className="kuraso-toolbar-sep" aria-hidden="true" />
          <button type="button" className="kuraso-icon-btn" style={{ height: 26, paddingInline: 5 }} title={tr("Underline")} aria-label={tr("Underline")} onClick={() => commit("blue", "underline")}>
            <Underline size={13} />
          </button>
          <button type="button" className="kuraso-icon-btn" style={{ height: 26, paddingInline: 5 }} title={tr("Strikethrough")} aria-label={tr("Strikethrough")} onClick={() => commit("red", "strikethrough")}>
            <Strikethrough size={13} />
          </button>
          <button type="button" className="kuraso-chip" title={tr("Highlight & add margin note (key N)")} onClick={() => commit("yellow", "highlight", true)}>
            + {tr("Note")}
          </button>
          {onExplainSelection && (
            <button
              type="button"
              className="kuraso-chip"
              data-active="true"
              title={tr("Explain selection with your AI (Ctrl+E)")}
              onClick={() => {
                onExplainSelection(pending.exact);
                window.getSelection()?.removeAllRanges();
                setPending(null);
              }}
            >
              {tr("Explain")}
            </button>
          )}
          <button type="button" className="kuraso-icon-btn" style={{ height: 26, paddingInline: 5 }} aria-label={tr("Close")} onClick={() => setPending(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      <article
        ref={articleRef}
        className="kuraso-clean-reader"
        data-focus={focusMode ? "true" : "false"}
        style={{ fontSize: `${fontSize}px` }}
        onMouseUp={handleMouseUp}
        onMouseDown={() => setPending(null)}
        onWheel={() => {
          userScrollAt.current = Date.now();
        }}
      >
        <div className="kuraso-clean-column">
          {!compact && (
            <h1 dir="auto" style={{ marginBlockStart: 0, lineHeight: 1.25 }}>
              {title}
            </h1>
          )}
          {paragraphs.map((p, pi) => {
            const heading = headingsByParagraph.get(p.id);
            const page = p.anchors[0]?.page ?? 1;
            return (
              <div key={p.id} className="kuraso-clean-block">
                {heading && (
                  <h2 dir="auto" className="kuraso-clean-heading">
                    {heading}
                  </h2>
                )}
                <p dir="auto" className="kuraso-clean-paragraph" data-pidx={pi} data-len={p.text.length}>
                  <button
                    type="button"
                    className="kuraso-clean-pid"
                    data-skip="true"
                    title={tr("Page {n}", { n: page })}
                    onClick={() => onJumpToPage?.(page)}
                  >
                    {p.id}
                  </button>
                  <ParagraphText text={p.text} segments={highlights.get(pi)} />
                </p>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}
