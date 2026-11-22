/**
 * Pure identifier extraction and deterministic paper slug helpers.
 * Supports DOIs (10.xxxx/...), arXiv IDs (new & old formats), and URLs.
 */

const DOI_REGEX = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/;
const ARXIV_URL_OR_PREFIX_REGEX =
  /(?:arxiv\.org\/(?:abs|pdf)\/|arXiv:\s*)([0-9]{4}\.[0-9]{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)/i;
const ARXIV_BARE_REGEX = /^([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)$/;

function stripTrailingPunctuation(val) {
  return val.replace(/[.,;)\]]+$/, "");
}

/**
 * Extract the first DOI and/or arXiv ID found in arbitrary text or a pasted URL/identifier.
 */
export function detectIdentifiers(input) {
  const text = (input ?? "").trim();
  if (!text) return { doi: null, arxivId: null };

  const doiMatch = text.match(DOI_REGEX);
  const doi = doiMatch ? stripTrailingPunctuation(doiMatch[1]) : null;

  const arxivPrefixed = text.match(ARXIV_URL_OR_PREFIX_REGEX);
  let arxivId = arxivPrefixed ? arxivPrefixed[1].replace(/\.pdf$/i, "") : null;

  if (!arxivId) {
    const bare = text.match(ARXIV_BARE_REGEX);
    if (bare) arxivId = bare[1];
  }

  return { doi, arxivId };
}

/**
 * Create a clean, filesystem-safe paper folder slug:
 *   e.g. "2024-smith-adversarial-ids-a1b2c3"
 */
export function makePaperSlug({ year, firstAuthor, title, fileHash }) {
  const yearPart = year ? String(year) : "undated";
  const authorLast = (firstAuthor ?? "unknown")
    .trim()
    .split(/\s+/)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "unknown";

  const titleWords = (title ?? "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .join("-") || "paper";

  const hashSuffix = (fileHash ?? "000000")
    .replace(/^sha256:/, "")
    .slice(0, 6)
    .toLowerCase();

  return `${yearPart}-${authorLast}-${titleWords}-${hashSuffix}`
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
