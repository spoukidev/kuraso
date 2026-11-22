/**
 * W3C Web Annotation helpers for Kuraso:
 * - Dual-anchored creation (TextQuoteSelector + TextPositionSelector + PdfRectSelector)
 * - Non-destructive re-mapping when structure.json is re-parsed
 * - Filtering & grouping for the Annotation Gathering panel
 */

export const SEMANTIC_LABELS = {
  yellow: "key-idea",
  green: "method",
  blue: "result",
  red: "limitation",
  purple: "to-cite",
};

export function createAnnotation({
  type = "highlight",
  color = "yellow",
  label,
  tags = [],
  note = null,
  exact,
  prefix = "",
  suffix = "",
  charStart = 0,
  charEnd = 0,
  anchors = [],
  paragraph = null,
}) {
  const now = new Date().toISOString();
  const rand = Math.random().toString(36).slice(2, 10);
  const selector = [
    { type: "TextQuoteSelector", exact, prefix, suffix },
    { type: "TextPositionSelector", start: charStart, end: charEnd },
  ];
  if (anchors.length > 0) {
    selector.push({ type: "PdfRectSelector", anchors });
  }

  return {
    id: `ann_${Date.now().toString(36)}${rand}`,
    type,
    color,
    label: label ?? SEMANTIC_LABELS[color] ?? null,
    tags: Array.from(new Set(tags.map((t) => (t.startsWith("#") ? t : `#${t}`)))),
    note,
    target: {
      paragraph,
      selector,
    },
    created: now,
    modified: now,
  };
}

export function getAnnotationQuote(ann) {
  const sel = ann.target?.selector?.find((s) => s.type === "TextQuoteSelector");
  return sel?.exact ?? "";
}

export function getAnnotationPage(ann) {
  const sel = ann.target?.selector?.find((s) => s.type === "PdfRectSelector");
  return sel?.anchors?.[0]?.page ?? 1;
}

export function getAnnotationAnchors(ann) {
  const sel = ann.target?.selector?.find((s) => s.type === "PdfRectSelector");
  return sel?.anchors ?? [];
}

/**
 * Re-map existing annotations onto a newly parsed `structure.json` using TextQuoteSelector.
 * Returns `{ remapped, unmatchedIds }` so nothing is silently lost on parser upgrades.
 */
export function remapAnnotationsToStructure(annotations, structure) {
  const paragraphs = structure?.paragraphs ?? [];
  const remapped = [];
  const unmatchedIds = [];

  for (const ann of annotations) {
    const quoteSel = ann.target?.selector?.find((s) => s.type === "TextQuoteSelector");
    const exact = quoteSel?.exact?.trim();
    if (!exact) {
      remapped.push(ann);
      continue;
    }

    const needle = exact.toLowerCase();
    const candidates = paragraphs.filter((p) => p.text.toLowerCase().includes(needle));

    if (candidates.length === 0) {
      unmatchedIds.push(ann.id);
      remapped.push(ann);
      continue;
    }

    let best = candidates[0];
    if (candidates.length > 1 && (quoteSel.prefix || quoteSel.suffix)) {
      const ctxNeedle = `${quoteSel.prefix ?? ""}${exact}${quoteSel.suffix ?? ""}`.toLowerCase();
      const ctxMatch = candidates.find((p) => p.text.toLowerCase().includes(ctxNeedle));
      if (ctxMatch) best = ctxMatch;
    }

    remapped.push({
      ...ann,
      target: {
        ...ann.target,
        paragraph: best.id,
      },
      modified: new Date().toISOString(),
    });
  }

  return { remapped, unmatchedIds };
}

/**
 * Filter and group annotations for the Annotation Gathering panel.
 */
export function filterAndGroupAnnotations(
  annotations,
  { color = "all", tag = "all", query = "", groupBy = "page" } = {},
) {
  const q = query.trim().toLowerCase();
  const filtered = annotations.filter((ann) => {
    if (color !== "all" && ann.color !== color) return false;
    if (tag !== "all" && !ann.tags.includes(tag)) return false;
    if (q) {
      const hay = [
        getAnnotationQuote(ann),
        ann.note ?? "",
        ann.label ?? "",
        ann.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const groups = new Map();
  for (const ann of filtered) {
    let key;
    if (groupBy === "color") {
      key = ann.label ? `${ann.color} (${ann.label})` : ann.color;
    } else if (groupBy === "tag") {
      key = ann.tags.length > 0 ? ann.tags[0] : "Untagged";
    } else {
      key = `Page ${getAnnotationPage(ann)}`;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ann);
  }

  return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
}
