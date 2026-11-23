/**
 * Obsidian-compatible [[wiki-links]] parser & backlinks index builder.
 */

const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;

export function normalizeLinkKey(target) {
  return String(target ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Extract all [[Target]] and [[Target|Alias]] links from a Markdown document.
 */
export function extractWikiLinks(markdown) {
  const links = [];
  const text = markdown ?? "";
  let m;
  WIKILINK_RE.lastIndex = 0;

  while ((m = WIKILINK_RE.exec(text)) !== null) {
    const target = m[1].trim();
    const alias = m[2] ? m[2].trim() : target;
    if (!target) continue;
    links.push({
      raw: m[0],
      target,
      alias,
      key: normalizeLinkKey(target),
      index: m.index,
    });
  }
  return links;
}

/**
 * Build a bidirectional backlinks map across all notes:
 *   notes: [{ id, title, markdown }]
 * Returns `{ [normalizedTargetKey]: [{ sourceId, sourceTitle, snippet }] }`
 */
export function buildBacklinksIndex(notes) {
  const index = {};
  for (const note of notes) {
    const text = note.markdown ?? "";
    const links = extractWikiLinks(text);
    const seenTargets = new Set();
    for (const link of links) {
      if (seenTargets.has(link.key)) continue;
      seenTargets.add(link.key);
      const start = Math.max(0, link.index - 40);
      const end = Math.min(text.length, link.index + link.raw.length + 40);
      const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
      if (!index[link.key]) index[link.key] = [];
      index[link.key].push({
        sourceId: note.id,
        sourceTitle: note.title,
        snippet,
      });
    }
  }
  return index;
}
