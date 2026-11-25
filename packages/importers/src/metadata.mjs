/**
 * Metadata fetchers for Crossref (DOI) and arXiv Atom API.
 * Strictly user-initiated / optional so Kuraso stays offline when disabled.
 */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Metadata text arrives with markup (<i>, <sub>, JATS tags) and HTML/XML entities. */
export function cleanMetadataText(value) {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/<\/?(?:[a-z]+:)?(?:i|b|em|strong|sub|sup|u|sc|span|italic|bold)\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
      if (code[0] === "#") {
        const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[code.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

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

  const title = (Array.isArray(msg.title) && cleanMetadataText(String(msg.title[0] ?? ""))) || doi;
  const authors = Array.isArray(msg.author)
    ? msg.author
        .map((a) => cleanMetadataText([a.given, a.family].filter(Boolean).join(" ")) ?? "")
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
      ? cleanMetadataText(String(msg["container-title"][0]))
      : null;
  const abstract = cleanMetadataText(msg.abstract);

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
    return m ? cleanMetadataText(m[1]) : null;
  };

  const title = extractTag("title") ?? `arXiv:${arxivId}`;
  const abstract = extractTag("summary");
  const published = extractTag("published");
  const year = published && /^\d{4}/.test(published) ? Number(published.slice(0, 4)) : null;

  const authors = [];
  const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>/gi;
  let m;
  while ((m = authorRegex.exec(entry)) !== null) {
    const name = cleanMetadataText(m[1]);
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
