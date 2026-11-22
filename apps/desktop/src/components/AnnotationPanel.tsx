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
          style={{ position: "absolute", insetInlineStart: 8, color: "var(--kuraso-text-muted)" }}
        />
        <input
          className="kuraso-input"
          style={{ width: "100%", paddingInlineStart: 26, fontSize: "0.78rem" }}
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
              title={`${c} (${SEMANTIC_LABELS[c]})`}
              style={{ backgroundColor: style.cssBg, borderColor: style.cssBorder }}
              onClick={() => setColorFilter(colorFilter === c ? "all" : c)}
            />
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <select
          className="kuraso-input"
          style={{ flex: 1, fontSize: "0.76rem", paddingBlock: 3 }}
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
            style={{ flex: 1, fontSize: "0.76rem", paddingBlock: 3 }}
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
        <p style={{ fontSize: "0.8rem", color: "var(--kuraso-text-muted)", margin: 0 }}>
          {annotations.length === 0
            ? "Select text in the PDF to create semantic highlights and margin notes (shortcuts 1–5 or N)."
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
                <div
                  key={ann.id}
                  className="kuraso-ann-card"
                  style={{ borderInlineStartColor: style.cssBorder }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      className="kuraso-ann-jump"
                      onClick={() => onJumpToPage(page)}
                    >
                      p.{page}
                      {ann.target.paragraph ? ` · ${ann.target.paragraph}` : ""}
                      {ann.label ? ` · ${ann.label}` : ""}
                    </button>
                    <button
                      type="button"
                      className="kuraso-icon-btn"
                      style={{ height: 22, paddingInline: 4 }}
                      title="Delete annotation"
                      onClick={() => onDeleteAnnotation(ann.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {quote && (
                    <blockquote
                      dir="auto"
                      className="kuraso-ann-quote"
                      style={{ backgroundColor: style.cssBg }}
                      onClick={() => onJumpToPage(page)}
                    >
                      “{quote}”
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
                        style={{ fontSize: "0.76rem" }}
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
                          style={{ paddingBlock: 4, paddingInline: 10, fontSize: "0.76rem" }}
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
                        <p dir="auto" style={{ margin: 0, fontSize: "0.8rem", lineHeight: 1.45 }}>
                          {ann.note}
                        </p>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "var(--kuraso-text-muted)" }}>
                          + Add margin note or tags…
                        </span>
                      )}
                      {ann.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {ann.tags.map((t) => (
                            <span key={t} className="kuraso-chip" style={{ fontSize: "0.68rem" }}>
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
