/**
 * Pure in-document search helper over extracted page texts.
 * Case-insensitive substring matching with snippet context for Phase 1.
 */

export function searchPageTexts(pages, query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const needle = trimmed.toLowerCase();
  const matches = [];

  for (const { page, text } of pages) {
    if (!text) continue;
    const lower = text.toLowerCase();
    let from = 0;
    let indexInPage = 0;

    while (from < lower.length) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const start = Math.max(0, idx - 32);
      const end = Math.min(text.length, idx + needle.length + 32);
      matches.push({
        page,
        indexInPage,
        charIndex: idx,
        length: needle.length,
        snippet: text.slice(start, end).replace(/\s+/g, " ").trim(),
      });
      indexInPage += 1;
      from = idx + needle.length;
    }
  }

  return matches;
}
