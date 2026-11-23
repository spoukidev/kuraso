import { useMemo, useState } from "react";
import type { Annotation, HighlightColor } from "@kuraso/formats";
import {
  filterAndGroupAnnotations,
  getAnnotationPage,
  getAnnotationQuote,
  SEMANTIC_LABELS,
} from "@kuraso/annotations";
import { SEMANTIC_HIGHLIGHT_DEFAULTS } from "@kuraso/ui";
import { Search, Trash2 } from "lucide-react";

interface AnnotationPanelProps {
  annotations: Annotation[];
  onJumpToPage: (page: number) => void;
  onUpdateAnnotation: (updated: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
}

const COLORS: HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

export function AnnotationPanel({
  annotations,
  onJumpToPage,
  onUpdateAnnotation,
  onDeleteAnnotation,
}: AnnotationPanelProps) {
  const [colorFilter, setColorFilter] = useState<HighlightColor | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | "all">("all");
  const [groupBy, setGroupBy] = useState<"page" | "color" | "tag">("page");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const ann of annotations) {
      for (const t of ann.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [annotations]);

  const grouped = useMemo(
    () =>
      filterAndGroupAnnotations(annotations, {
        color: colorFilter,
        tag: tagFilter,
        query,
        groupBy,
      }),
    [annotations, colorFilter, tagFilter, query, groupBy],
  );

  function beginEdit(ann: Annotation) {
    setEditingId(ann.id);
    setNoteDraft(ann.note ?? "");
    setTagsDraft(ann.tags.join(", "));
  }

  function commitEdit(ann: Annotation) {
    const normalizedTags = Array.from(
      new Set(
        tagsDraft
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => (t.startsWith("#") ? t : `#${t}`)),
      ),
    );
    onUpdateAnnotation({
      ...ann,
      note: noteDraft.trim() || null,
      tags: normalizedTags,
      modified: new Date().toISOString(),
    });
    setEditingId(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Search
          size={13}
          style={{ position: "absolute", insetInlineStart: 10, color: "var(--kuraso-text-muted)" }}
        />
        <input
          className="kuraso-input"
          style={{ width: "100%", paddingInlineStart: 28, borderRadius: 999 }}
          placeholder="Filter highlights & notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Color filter dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          className="kuraso-chip"
          data-active={colorFilter === "all" ? "true" : "false"}
          onClick={() => setColorFilter("all")}
        >
          All ({annotations.length})
        </button>
        {COLORS.map((c) => {
          const style = SEMANTIC_HIGHLIGHT_DEFAULTS[c];
          return (
            <button
              key={c}
              type="button"
              className="kuraso-color-dot"
              data-active={colorFilter === c ? "true" : "false"}
              title={`${style.key} · ${SEMANTIC_LABELS[c]}`}
              aria-label={`Filter: ${SEMANTIC_LABELS[c]}`}
              aria-pressed={colorFilter === c}
              style={{ backgroundColor: style.cssMarker }}
              onClick={() => setColorFilter(colorFilter === c ? "all" : c)}
            >
              {style.key}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <select
          className="kuraso-input"
          style={{ flex: 1, minWidth: 0, fontSize: 12, paddingBlock: 4 }}
          aria-label="Group annotations"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as "page" | "color" | "tag")}
        >
          <option value="page">Group: Page</option>
          <option value="color">Group: Color</option>
          <option value="tag">Group: Tag</option>
        </select>

        {allTags.length > 0 && (
          <select
            className="kuraso-input"
            style={{ flex: 1, minWidth: 0, fontSize: 12, paddingBlock: 4 }}
            aria-label="Filter by tag"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="all">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {grouped.length === 0 ? (
        <p className="kuraso-panel-hint">
          {annotations.length === 0
            ? "Select text in the paper, then press 1–5 to highlight or N for a margin note."
            : "No annotations match the active filter."}
        </p>
      ) : (
        grouped.map(({ group, items }) => (
          <div key={group} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="kuraso-section-label" style={{ marginBlockEnd: 2 }}>
              {group}
            </div>
            {items.map((ann) => {
              const style = SEMANTIC_HIGHLIGHT_DEFAULTS[ann.color];
              const page = getAnnotationPage(ann);
              const quote = getAnnotationQuote(ann);
              const isEditing = editingId === ann.id;
              return (
                <div key={ann.id} className="kuraso-ann-card">
                  <div className="kuraso-ann-head">
                    <span className="kuraso-ann-label" style={{ backgroundColor: style.cssMarker }}>
                      {(ann.label ?? SEMANTIC_LABELS[ann.color] ?? ann.color).replace(/-/g, " ")}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        className="kuraso-ann-jump"
                        title="Jump to this highlight"
                        onClick={() => onJumpToPage(page)}
                      >
                        p.{page}
                        {ann.target.paragraph ? ` · ${ann.target.paragraph}` : ""}
                      </button>
                      <button
                        type="button"
                        className="kuraso-icon-btn"
                        style={{ height: 24, paddingInline: 5 }}
                        title="Delete annotation"
                        aria-label="Delete annotation"
                        onClick={() => onDeleteAnnotation(ann.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </div>

                  {quote && (
                    <blockquote
                      dir="auto"
                      className="kuraso-ann-quote"
                      onClick={() => onJumpToPage(page)}
                    >
                      <mark style={{ backgroundColor: style.cssBg }}>{quote}</mark>
                    </blockquote>
                  )}

                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <textarea
                        className="kuraso-input"
                        dir="auto"
                        rows={3}
                        placeholder="Margin note (Markdown)…"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                      />
                      <input
                        className="kuraso-input"
                        placeholder="#dataset, #limitation"
                        value={tagsDraft}
                        onChange={(e) => setTagsDraft(e.target.value)}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          type="button"
                          className="kuraso-icon-btn"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="kuraso-primary-btn"
                          style={{ paddingBlock: 5, paddingInline: 14, fontSize: 13, boxShadow: "none" }}
                          onClick={() => commitEdit(ann)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 4, cursor: "pointer" }}
                      onClick={() => beginEdit(ann)}
                      title="Click to edit note or tags"
                    >
                      {ann.note ? (
                        <p dir="auto" className="kuraso-ann-sticky">
                          {ann.note}
                        </p>
                      ) : (
                        <span className="kuraso-ann-add">+ Add a margin note or #tags</span>
                      )}
                      {ann.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {ann.tags.map((t) => (
                            <span key={t} className="kuraso-chip" data-tag="true">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
