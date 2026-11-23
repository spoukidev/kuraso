/**
 * Pure BibTeX parser for importing existing bibliographies and Zotero BibTeX exports.
 */

function cleanBibValue(raw) {
  let s = (raw ?? "").trim();
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1);
  }
  return s
    .replace(/[{}]/g, "")
    .replace(/\\&/g, "&")
    .replace(/\\%/g, "%")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseBibtex(input) {
  const entries = [];
  const text = input ?? "";
  const entryRe = /@([a-zA-Z]+)\s*\{\s*([^,]+),([\s\S]*?)\n\s*\}(?=\s*(?:@|$))/g;
  let match;

  while ((match = entryRe.exec(text)) !== null) {
    const body = match[3];
    const fields = {};
    const fieldRe = /([a-zA-Z0-9_-]+)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|\d+)/g;
    let fm;
    while ((fm = fieldRe.exec(body)) !== null) {
      fields[fm[1].toLowerCase()] = cleanBibValue(fm[2]);
    }

    const title = fields.title;
    if (!title) continue;

    const authors = (fields.author ?? "")
      .split(/\s+and\s+/i)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => {
        if (name.includes(",")) {
          const [last, first] = name.split(",").map((p) => p.trim());
          return { name: [first, last].filter(Boolean).join(" "), orcid: null };
        }
        return { name, orcid: null };
      });

    const yearNum = fields.year ? Number(fields.year) : null;
    const venue = fields.journal || fields.booktitle || fields.publisher || (fields.eprint ? "arXiv" : null);

    entries.push({
      title,
      authors,
      year: yearNum && !Number.isNaN(yearNum) ? yearNum : null,
      venue,
      doi: fields.doi ?? null,
      arxivId: fields.eprint ?? null,
      url: fields.url ?? (fields.doi ? `https://doi.org/${fields.doi}` : null),
      abstract: fields.abstract ?? null,
      openAccessPdfUrl: fields.eprint ? `https://arxiv.org/pdf/${fields.eprint}.pdf` : null,
    });
  }

  return entries;
}
