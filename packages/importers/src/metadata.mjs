/**
 * Metadata fetchers for Crossref (DOI) and arXiv Atom API.
 * Strictly user-initiated / optional so Kuraso stays offline when disabled.
 */

export async function fetchMetadataByDoi(doi, fetchImpl = globalThis.fetch) {
  const encoded = encodeURIComponent(doi.trim());
  const url = `https://api.crossref.org/works/${encoded}`;
  const res = await fetchImpl(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Crossref lookup failed (${res.status}) for DOI ${doi}`);
  }
  const json = await res.json();
  const msg = json?.message ?? {};

  const title = Array.isArray(msg.title) && msg.title[0] ? String(msg.title[0]).trim() : doi;
  const authors = Array.isArray(msg.author)
    ? msg.author
        .map((a) => [a.given, a.family].filter(Boolean).join(" ").trim())
        .filter(Boolean)
        .map((name) => ({ name, orcid: null }))
    : [];

  const dateParts =
    msg.published?.["date-parts"]?.[0] ??
    msg["published-print"]?.["date-parts"]?.[0] ??
    msg["published-online"]?.["date-parts"]?.[0] ??
    null;
  const year = Array.isArray(dateParts) && typeof dateParts[0] === "number" ? dateParts[0] : null;
  const venue =
    Array.isArray(msg["container-title"]) && msg["container-title"][0]
      ? String(msg["container-title"][0]).trim()
      : null;
  const abstract =
    typeof msg.abstract === "string"
      ? msg.abstract.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : null;

  return {
    title,
    authors,
    year,
    venue,
    doi: doi.trim(),
    arxivId: null,
    url: typeof msg.URL === "string" ? msg.URL : `https://doi.org/${doi.trim()}`,
    abstract,
    openAccessPdfUrl: null,
  };
}

/**
 * Parse a minimal arXiv Atom XML response without external XML libraries.
 */
export function parseArxivAtomXml(xml, arxivId) {
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i);
  if (!entryMatch) {
    throw new Error(`No arXiv entry found for ${arxivId}`);
  }
  const entry = entryMatch[1];

  const extractTag = (tag) => {
    const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return m ? m[1].replace(/\s+/g, " ").trim() : null;
  };

  const title = extractTag("title") ?? `arXiv:${arxivId}`;
  const abstract = extractTag("summary");
  const published = extractTag("published");
  const year = published && /^\d{4}/.test(published) ? Number(published.slice(0, 4)) : null;

  const authors = [];
  const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>/gi;
  let m;
  while ((m = authorRegex.exec(entry)) !== null) {
    const name = m[1].replace(/\s+/g, " ").trim();
    if (name) authors.push({ name, orcid: null });
  }

  const doi = extractTag("arxiv:doi");
  const cleanId = arxivId.trim();

  return {
    title,
    authors,
    year,
    venue: "arXiv",
    doi,
    arxivId: cleanId,
    url: `https://arxiv.org/abs/${cleanId}`,
    abstract,
    openAccessPdfUrl: `https://arxiv.org/pdf/${cleanId}.pdf`,
  };
}

export async function fetchMetadataByArxiv(arxivId, fetchImpl = globalThis.fetch) {
  const encoded = encodeURIComponent(arxivId.trim());
  const url = `https://export.arxiv.org/api/query?id_list=${encoded}`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`arXiv lookup failed (${res.status}) for ${arxivId}`);
  }
  const xml = await res.text();
  return parseArxivAtomXml(xml, arxivId);
}
