/**
 * Formatted academic citation generator (APA, IEEE, ACM).
 */

function formatAuthorApa(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts.pop();
  const initials = parts.map((p) => `${p[0]?.toUpperCase() ?? ""}.`).join(" ");
  return `${last}, ${initials}`;
}

function formatAuthorIeee(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts.pop();
  const initials = parts.map((p) => `${p[0]?.toUpperCase() ?? ""}.`).join(" ");
  return `${initials} ${last}`;
}

export function formatCitation(paper, style = "apa") {
  const authors = paper.authors?.map((a) => a.name).filter(Boolean) ?? [];
  const year = paper.year ? String(paper.year) : "n.d.";
  const title = (paper.title ?? "Untitled").trim();
  const venue = paper.venue?.trim() ?? "";
  const doiPart = paper.doi ? `https://doi.org/${paper.doi}` : paper.url ?? "";

  if (style === "ieee") {
    const authStr =
      authors.length === 0
        ? "Unknown"
        : authors.length === 1
          ? formatAuthorIeee(authors[0])
          : `${authors.slice(0, -1).map(formatAuthorIeee).join(", ")} and ${formatAuthorIeee(authors[authors.length - 1])}`;
    return [
      `${authStr},`,
      `"${title},"`,
      venue ? `${venue},` : "",
      `${year}.`,
      paper.doi ? `doi: ${paper.doi}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (style === "acm") {
    const authStr =
      authors.length === 0
        ? "Unknown"
        : authors.length === 1
          ? authors[0]
          : `${authors.slice(0, -1).join(", ")}, and ${authors[authors.length - 1]}`;
    return [
      `${authStr}.`,
      `${year}.`,
      `${title}.`,
      venue ? `In ${venue}.` : "",
      doiPart,
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Default: APA 7th
  const authStr =
    authors.length === 0
      ? "Unknown."
      : authors.length === 1
        ? `${formatAuthorApa(authors[0])}`
        : `${authors.slice(0, -1).map(formatAuthorApa).join(", ")}, & ${formatAuthorApa(authors[authors.length - 1])}`;

  return [
    `${authStr} (${year}).`,
    `${title}.`,
    venue ? `${venue}.` : "",
    doiPart,
  ]
    .filter(Boolean)
    .join(" ");
}
