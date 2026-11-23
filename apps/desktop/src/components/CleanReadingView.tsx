import { useState } from "react";
import type { Annotation, PaperStructure } from "@kuraso/formats";
import { getAnnotationQuote } from "@kuraso/annotations";
import { SEMANTIC_HIGHLIGHT_DEFAULTS } from "@kuraso/ui";
import { Eye, Minus, Plus } from "lucide-react";

interface CleanReadingViewProps {
  title: string;
  structure: PaperStructure | null | undefined;
  annotations: Annotation[];
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onExitCleanMode: () => void;
}

/**
 * Renders a paragraph with any matching W3C TextQuoteSelector highlights
 * shown inline — proving dual-anchored annotations work across both PDF & Reflow views.
 */
function HighlightedParagraphText({
  text,
  annotations,
}: {
  text: string;
  annotations: Annotation[];
}) {
  const lower = text.toLowerCase();
  let bestMatch: { start: number; end: number; ann: Annotation } | null = null;

  for (const ann of annotations) {
    const quote = getAnnotationQuote(ann).trim();
    if (quote.length < 4) continue;
    const idx = lower.indexOf(quote.toLowerCase());
    if (idx !== -1 && (!bestMatch || idx < bestMatch.start)) {
      bestMatch = { start: idx, end: idx + quote.length, ann };
    }
  }

  if (!bestMatch) return <>{text}</>;
  const style = SEMANTIC_HIGHLIGHT_DEFAULTS[bestMatch.ann.color];
  return (
    <>
      {text.slice(0, bestMatch.start)}
      <mark
        style={{
          backgroundColor: style.cssBg,
          paddingInline: 2,
        }}
      >
        {text.slice(bestMatch.start, bestMatch.end)}
      </mark>
      {text.slice(bestMatch.end)}
    </>
  );
}

export function CleanReadingView({
  title,
  structure,
  annotations,
  focusMode,
  onToggleFocusMode,
  onExitCleanMode,
}: CleanReadingViewProps) {
  const [fontSize, setFontSize] = useState(17);

  if (!structure || structure.paragraphs.length === 0) {
    return (
      <div className="kuraso-empty-state">
        <p>Clean Reading Mode requires extracted text paragraphs from this PDF.</p>
        <button type="button" className="kuraso-primary-btn" onClick={onExitCleanMode}>
          Return to Original PDF
        </button>
      </div>
    );
  }

  const headingsByParagraph = new Map<string, string>();
  for (const h of structure.headings) {
    if (h.paragraphId && !headingsByParagraph.has(h.paragraphId)) {
      headingsByParagraph.set(h.paragraphId, h.title);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="kuraso-reader-toolbar">
        <div className="kuraso-reader-toolbar-group">
          <strong>Clean Reading Mode</strong>
          <span style={{ color: "var(--kuraso-text-muted)" }}>
            · {structure.paragraphs.length} paragraphs
          </span>
        </div>

        <div className="kuraso-reader-toolbar-group">
          <button
            type="button"
            className="kuraso-icon-btn"
            title="Decrease reading font size"
            onClick={() => setFontSize((s) => Math.max(13, s - 1))}
          >
            <Minus size={14} />
          </button>
          <span style={{ minWidth: 38, textAlign: "center" }}>{fontSize}px</span>
          <button
            type="button"
            className="kuraso-icon-btn"
            title="Increase reading font size"
            onClick={() => setFontSize((s) => Math.min(26, s + 1))}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            data-active={focusMode ? "true" : "false"}
            title="Focus mode (F11)"
            onClick={onToggleFocusMode}
          >
            <Eye size={14} />
            <span>Focus</span>
          </button>
          <button type="button" className="kuraso-chip" onClick={onExitCleanMode}>
            Original PDF (Ctrl+R)
          </button>
        </div>
      </div>

      <article
        className="kuraso-clean-reader"
        data-focus={focusMode ? "true" : "false"}
        style={{ fontSize: `${fontSize}px` }}
      >
        <div className="kuraso-clean-column">
          <h1 dir="auto" style={{ marginBlockStart: 0, lineHeight: 1.25 }}>
            {title}
          </h1>
          {structure.paragraphs.map((p) => {
            const heading = headingsByParagraph.get(p.id);
            const page = p.anchors[0]?.page ?? 1;
            return (
              <div key={p.id} className="kuraso-clean-block">
                {heading && (
                  <h2 dir="auto" className="kuraso-clean-heading">
                    {heading}
                  </h2>
                )}
                <p dir="auto" className="kuraso-clean-paragraph">
                  <span className="kuraso-clean-pid" title={`Page ${page}`}>
                    {p.id}
                  </span>
                  <HighlightedParagraphText text={p.text} annotations={annotations} />
                </p>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}
