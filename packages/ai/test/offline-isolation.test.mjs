import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectIdentifiers, makePaperSlug } from "../../importers/src/identifiers.mjs";
import { segmentPagesToStructure } from "../../reader/src/structure.mjs";
import { searchPageTexts } from "../../reader/src/search.mjs";
import { createAnnotation, remapAnnotationsToStructure } from "../../annotations/src/annotations.mjs";
import { exportPaperToMarkdown } from "../../exporters/src/markdown.mjs";
import { exportPaperToBibtex } from "../../exporters/src/bibtex.mjs";
import { verifyGroundedResponse } from "../src/grounding.mjs";

describe("Offline network-isolation guarantee (v0.1 Definition of Done)", () => {
  it("performs zero outbound network calls during core local workflows", () => {
    const originalFetch = globalThis.fetch;
    let networkCalls = 0;

    globalThis.fetch = (...args) => {
      networkCalls += 1;
      throw new Error(`Unexpected outbound network call in offline mode: ${String(args[0])}`);
    };

    try {
      const ids = detectIdentifiers("DOI: 10.1109/SP.2024.00012");
      const slug = makePaperSlug({ year: 2024, firstAuthor: "Amina Benali", title: "Offline IDS", fileHash: "sha256:abcdef123456" });
      const structure = segmentPagesToStructure([
        {
          page: 1,
          lines: [
            { text: "1. Introduction", fontHeight: 12, rect: [72, 700, 200, 712] },
            { text: "Offline reading and annotation work with zero internet access.", fontHeight: 10, rect: [72, 670, 480, 682] },
          ],
        },
      ]);
      const hits = searchPageTexts([{ page: 1, text: structure.paragraphs[0].text }], "offline");
      const ann = createAnnotation({
        exact: "zero internet access",
        anchors: [{ page: 1, rect: [72, 670, 220, 682] }],
        paragraph: "P1",
      });
      const remapped = remapAnnotationsToStructure([ann], structure);
      const verified = verifyGroundedResponse("Works offline [P1].", ["P1"]);
      const paper = {
        id: "pap_1",
        slug,
        title: "Offline IDS",
        authors: [{ name: "Amina Benali", orcid: null }],
        year: 2024,
        venue: "IEEE",
        doi: ids.doi,
        arxivId: null,
        url: null,
        abstract: null,
        language: "en",
        pageCount: 1,
        fileHash: "sha256:" + "a".repeat(64),
        scanned: false,
        status: "reading",
        tags: [],
        readingPosition: null,
        addedAt: "2026-11-22T00:00:00Z",
        updatedAt: "2026-11-22T00:00:00Z",
        readAt: null,
      };
      const md = exportPaperToMarkdown({ paper, annotations: remapped.remapped, notesMarkdown: "Local note" });
      const bib = exportPaperToBibtex(paper);

      assert.equal(hits.length, 1);
      assert.equal(verified.sentences[0].status, "supported");
      assert.ok(md.includes("zero internet access"));
      assert.ok(bib.includes("@article{benali2024offline,"));
      assert.equal(networkCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
