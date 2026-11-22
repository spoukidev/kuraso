/**
 * Clean BibTeX citation exporter for individual papers and collections.
 */

function escapeBibtex(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_])/g, "\\$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeCitationKey(paper) {
  const firstAuthor = paper.authors?.[0]?.name ?? "unknown";
  const lastName =
    firstAuthor
      .trim()
      .split(/\s+/)
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "unknown";
  const year = paper.year ? String(paper.year) : "nd";
  const keyword =
    (paper.title ?? "paper")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .find((w) => w.length > 3) || "paper";
  return `${lastName}${year}${keyword}`;
}

export function exportPaperToBibtex(paper) {
  const isArxivOnly = Boolean(paper.arxivId) && (!paper.venue || paper.venue.toLowerCase() === "arxiv");
  const entryType = isArxivOnly ? "misc" : "article";
  const key = makeCitationKey(paper);

  const fields = [];
  fields.push(`  title = {${escapeBibtex(paper.title)}}`);
  if (paper.authors?.length) {
    const authorsJoined = paper.authors.map((a) => escapeBibtex(a.name)).join(" and ");
    fields.push(`  author = {${authorsJoined}}`);
  }
  if (paper.year) {
    fields.push(`  year = {${paper.year}}`);
  }
  if (paper.venue && !isArxivOnly) {
    fields.push(`  journal = {${escapeBibtex(paper.venue)}}`);
  }
  if (paper.doi) {
    fields.push(`  doi = {${escapeBibtex(paper.doi)}}`);
  }
  if (paper.arxivId) {
    fields.push(`  eprint = {${escapeBibtex(paper.arxivId)}}`);
    fields.push(`  archivePrefix = {arXiv}`);
  }
  if (paper.url) {
    fields.push(`  url = {${escapeBibtex(paper.url)}}`);
  }

  return `@${entryType}{${key},\n${fields.join(",\n")}\n}`;
}

export function exportCollectionToBibtex(papers) {
  return papers.map(exportPaperToBibtex).join("\n\n") + (papers.length ? "\n" : "");
}
