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
import { tr } from "../i18n/tr";

interface AnnotationPanelProps {
  annotations: Annotation[];
  onJumpToPage: (page: number) => void;
  onUpdateAnnotation: (updated: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
}

const COLORS: HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

/** Group keys come from @kuraso/annotations in English; translate them for display only. */
function groupLabel(group: string): string {
  const page = /^Page (\d+)$/.exec(group);
  if (page) return tr("Page {n}", { n: page[1] ?? "" });
  if (group === "Untagged") return tr("Untagged");
  const colored = /^(\w+) \((.+)\)$/.exec(group);
  if (colored) return `${tr(colored[1] ?? "")} · ${tr(colored[2] ?? "").replace(/-/g, " ")}`;
  return tr(group);
}

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
          placeholder={tr("Filter highlights & notes…")}
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
          {tr("All ({n})", { n: annotations.length })}
        </button>
        {COLORS.map((c) => {
          const style = SEMANTIC_HIGHLIGHT_DEFAULTS[c];
          return (
            <button
              key={c}
              type="button"
              className="kuraso-color-dot"
              data-active={colorFilter === c ? "true" : "false"}
              title={`${style.key} · ${tr(SEMANTIC_LABELS[c])}`}
              aria-label={tr("Filter: {label}", { label: tr(SEMANTIC_LABELS[c]) })}
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
          aria-label={tr("Group annotations")}
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as "page" | "color" | "tag")}
        >
          <option value="page">{tr("Group: Page")}</option>
          <option value="color">{tr("Group: Color")}</option>
          <option value="tag">{tr("Group: Tag")}</option>
        </select>

        {allTags.length > 0 && (
          <select
            className="kuraso-input"
            style={{ flex: 1, minWidth: 0, fontSize: 12, paddingBlock: 4 }}
            aria-label={tr("Filter by tag")}
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="all">{tr("All tags")}</option>
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
            ? tr("Select text in the paper, then press 1–5 to highlight or N for a margin note.")
            : tr("No annotations match the active filter.")}
        </p>
      ) : (
        grouped.map(({ group, items }) => (
          <div key={group} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="kuraso-section-label" style={{ marginBlockEnd: 2 }}>
              {groupLabel(group)}
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
                      {tr(ann.label ?? SEMANTIC_LABELS[ann.color] ?? ann.color).replace(/-/g, " ")}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        className="kuraso-ann-jump"
                        title={tr("Jump to this highlight")}
                        onClick={() => onJumpToPage(page)}
                      >
                        <bdi dir="ltr">
                          p.{page}
                          {ann.target.paragraph ? ` · ${ann.target.paragraph}` : ""}
                        </bdi>
                      </button>
                      <button
                        type="button"
                        className="kuraso-icon-btn"
                        style={{ height: 24, paddingInline: 5 }}
                        title={tr("Delete annotation")}
                        aria-label={tr("Delete annotation")}
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
                        placeholder={tr("Margin note (Markdown)…")}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                      />
                      <input
                        className="kuraso-input"
                        dir="auto"
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
                          {tr("Cancel")}
                        </button>
                        <button
                          type="button"
                          className="kuraso-primary-btn"
                          style={{ paddingBlock: 5, paddingInline: 14, fontSize: 13, boxShadow: "none" }}
                          onClick={() => commitEdit(ann)}
                        >
                          {tr("Save")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 4, cursor: "pointer" }}
                      onClick={() => beginEdit(ann)}
                      title={tr("Click to edit note or tags")}
                    >
                      {ann.note ? (
                        <p dir="auto" className="kuraso-ann-sticky">
                          {ann.note}
                        </p>
                      ) : (
                        <span className="kuraso-ann-add">{tr("+ Add a margin note or #tags")}</span>
                      )}
                      {ann.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {ann.tags.map((t) => (
                            <span key={t} className="kuraso-chip" data-tag="true" dir="auto">
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
