/**
 * Obsidian-compatible Markdown exporter for Kuraso papers, highlights, and notes.
 */

function yamlEscape(val) {
  return `"${String(val ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function getQuote(ann) {
  const sel = ann.target?.selector?.find((s) => s.type === "TextQuoteSelector");
  return sel?.exact ?? "";
}

function getPage(ann) {
  const sel = ann.target?.selector?.find((s) => s.type === "PdfRectSelector");
  return sel?.anchors?.[0]?.page ?? 1;
}

const COLOR_BADGE = {
  yellow: "🟨",
  green: "🟩",
  blue: "🟦",
  red: "🟥",
  purple: "🟪",
};

export function exportPaperToMarkdown({ paper, annotations = [], notesMarkdown = "", summary = null }) {
  const lines = ["---"];
  lines.push(`title: ${yamlEscape(paper.title)}`);
  if (paper.authors?.length) {
    lines.push("authors:");
    for (const a of paper.authors) {
      lines.push(`  - ${yamlEscape(a.name)}`);
    }
  }
  if (paper.year) lines.push(`year: ${paper.year}`);
  if (paper.venue) lines.push(`venue: ${yamlEscape(paper.venue)}`);
  if (paper.doi) lines.push(`doi: ${yamlEscape(paper.doi)}`);
  if (paper.arxivId) lines.push(`arxiv: ${yamlEscape(paper.arxivId)}`);
  lines.push(`status: ${paper.status}`);
  if (paper.tags?.length) {
    lines.push(`tags: [${paper.tags.map((t) => yamlEscape(t.replace(/^#/, ""))).join(", ")}]`);
  }
  lines.push("---", "");
  lines.push(`# ${paper.title}`, "");

  if (paper.authors?.length || paper.year || paper.venue) {
    const metaBits = [
      paper.authors?.map((a) => a.name).join(", "),
      paper.venue,
      paper.year ? String(paper.year) : null,
    ].filter(Boolean);
    lines.push(`*${metaBits.join(" · ")}*`, "");
  }

  if (annotations.length > 0) {
    lines.push("## Highlights & Margin Notes", "");
    const sorted = [...annotations].sort((a, b) => getPage(a) - getPage(b));
    for (const ann of sorted) {
      const page = getPage(ann);
      const badge = COLOR_BADGE[ann.color] ?? "•";
      const label = ann.label ? ` **${ann.label}**` : "";
      const para = ann.target?.paragraph ? ` (${ann.target.paragraph})` : "";
      const quote = getQuote(ann);
      lines.push(`- ${badge}${label} — p.${page}${para}`);
      if (quote) lines.push(`  > ${quote}`);
      if (ann.note) lines.push(`  - **Note:** ${ann.note}`);
      if (ann.tags?.length) lines.push(`  - *Tags:* ${ann.tags.join(" ")}`);
    }
    lines.push("");
  }

  const trimmedNotes = (notesMarkdown ?? "").trim();
  if (trimmedNotes) {
    lines.push("## Notes", "", trimmedNotes, "");
  }

  if (summary && Array.isArray(summary.sentences) && summary.sentences.length > 0) {
    lines.push("## AI Summary *(AI-generated · Grounded)*", "");
    for (const s of summary.sentences) {
      if (s.status === "heading") {
        lines.push(`### ${s.text.replace(/^#{1,4}\s+/, "")}`);
      } else {
        const cites = s.citations?.length ? ` ${s.citations.map((c) => `[${c}]`).join("")}` : "";
        lines.push(`${s.text}${cites}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
