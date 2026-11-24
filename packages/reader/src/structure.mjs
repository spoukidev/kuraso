/**
 * Heuristic heading detection & paragraph segmentation (no AI, no sidecar).
 * Produces a `structure.json`-compatible object with `parserVersion: 1`,
 * `coordinateSpace: "pdf-cropbox-points-bl-unrotated"`, headings, and `P1..Pn` paragraphs.
 */

const KNOWN_SECTIONS = new Set([
  "abstract",
  "introduction",
  "background",
  "related work",
  "literature review",
  "method",
  "methodology",
  "methods",
  "approach",
  "proposed method",
  "experimental setup",
  "experiments",
  "evaluation",
  "results",
  "discussion",
  "limitations",
  "threats to validity",
  "future work",
  "conclusion",
  "conclusions",
  "acknowledgments",
  "acknowledgements",
  "references",
  "appendix",
]);

const NUMBERED_HEADING_RE = /^(?:(\d+(?:\.\d+){0,2})\.?|([IVX]{1,5})\.)\s+([A-Z][^\n]{2,80})$/;

export function detectHeadingLevel(line, fontHeight = 10, medianFontHeight = 10) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 90 || /[.?!;]$/.test(trimmed)) return null;

  const lower = trimmed.toLowerCase().replace(/^\d+(?:\.\d+)*\.?\s+/, "");
  if (KNOWN_SECTIONS.has(lower)) {
    return 1;
  }

  const numbered = trimmed.match(NUMBERED_HEADING_RE);
  if (numbered) {
    if (numbered[1]) {
      const depth = numbered[1].split(".").length;
      return Math.min(depth, 3);
    }
    return 1;
  }

  if (fontHeight >= medianFontHeight * 1.28 && trimmed.length >= 4 && trimmed.length <= 75) {
    return fontHeight >= medianFontHeight * 1.5 ? 1 : 2;
  }

  return null;
}

/**
 * Segment extracted pages into headings + sequential `P1..Pn` paragraphs.
 * Each page entry is `{ page: number, lines: { text: string, fontHeight?: number, rect?: [number,number,number,number] }[] }`.
 */
export function segmentPagesToStructure(pages) {
  const allHeights = [];
  for (const p of pages) {
    for (const line of p.lines ?? []) {
      if (typeof line.fontHeight === "number" && line.fontHeight > 0) {
        allHeights.push(line.fontHeight);
      }
    }
  }
  allHeights.sort((a, b) => a - b);
  const medianFontHeight =
    allHeights.length > 0 ? allHeights[Math.floor(allHeights.length / 2)] : 10;

  const headings = [];
  const paragraphs = [];
  let currentSection = "Front Matter";
  let charCursor = 0;
  let bufferLines = [];
  let bufferAnchors = [];

  function flushParagraph() {
    if (bufferLines.length === 0) return;
    const text = bufferLines.join(" ").replace(/\s+/g, " ").trim();
    if (text.length >= 20) {
      const id = `P${paragraphs.length + 1}`;
      const charStart = charCursor;
      const charEnd = charStart + text.length;
      charCursor = charEnd + 1;
      paragraphs.push({
        id,
        section: currentSection,
        text,
        charStart,
        charEnd,
        anchors:
          bufferAnchors.length > 0
            ? bufferAnchors
            : [{ page: 1, rect: [0, 0, 100, 12] }],
      });
    }
    bufferLines = [];
    bufferAnchors = [];
  }

  for (const pageObj of pages) {
    const pageNum = pageObj.page;
    for (const line of pageObj.lines ?? []) {
      const text = (line.text ?? "").trim();
      if (!text) {
        flushParagraph();
        continue;
      }

      const headingLevel = detectHeadingLevel(
        text,
        line.fontHeight ?? medianFontHeight,
        medianFontHeight,
      );

      if (headingLevel !== null) {
        flushParagraph();
        currentSection = text;
        headings.push({
          id: `h_${headings.length + 1}`,
          title: text,
          level: headingLevel,
          page: pageNum,
          paragraphId: `P${paragraphs.length + 1}`,
          source: "heuristic",
        });
        continue;
      }

      bufferLines.push(text);
      if (line.rect) {
        // `text` lets Reflow map a character range back onto exact PDF rectangles.
        bufferAnchors.push({ page: pageNum, rect: line.rect, text });
      } else if (bufferAnchors.length === 0) {
        bufferAnchors.push({ page: pageNum, rect: [0, 0, 100, 12] });
      }

      // Split paragraph cleanly on sentence end when buffer is reasonably long
      if (bufferLines.length >= 4 && /[.!?]$/.test(text)) {
        flushParagraph();
      }
    }
    flushParagraph();
  }

  return {
    parserVersion: 1,
    coordinateSpace: "pdf-cropbox-points-bl-unrotated",
    pageCount: pages.length || 1,
    headings,
    paragraphs,
    generatedAt: new Date().toISOString(),
  };
}
