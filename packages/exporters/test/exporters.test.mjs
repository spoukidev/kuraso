import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exportPaperToMarkdown } from "../src/markdown.mjs";
import {
  exportCollectionToBibtex,
  exportPaperToBibtex,
  makeCitationKey,
} from "../src/bibtex.mjs";

const SAMPLE_PAPER = {
  id: "pap_1234567890ab",
  slug: "2024-benali-adversarial-ids-123456",
  title: "Adversarial Robustness in 6G Intrusion Detection",
  authors: [{ name: "Amina Benali", orcid: null }, { name: "Karim Mansouri", orcid: null }],
  year: 2024,
  venue: "IEEE S&P",
  doi: "10.1109/SP.2024.00012",
  arxivId: null,
  url: "https://doi.org/10.1109/SP.2024.00012",
  abstract: null,
  language: "en",
  pageCount: 12,
  fileHash: "sha256:" + "a".repeat(64),
  scanned: false,
  status: "important",
  tags: ["#6G", "#ids"],
  readingPosition: null,
  addedAt: "2026-11-21T00:00:00Z",
  updatedAt: "2026-11-21T00:00:00Z",
  readAt: null,
};

describe("@kuraso/exporters Markdown & BibTeX", () => {
  it("exports Obsidian-compatible Markdown with YAML frontmatter, highlights, notes, and AI label", () => {
    const md = exportPaperToMarkdown({
      paper: SAMPLE_PAPER,
      annotations: [
        {
          id: "ann_1",
          type: "highlight",
          color: "red",
          label: "limitation",
          tags: ["#dataset"],
          note: "Only tested on synthetic traffic",
          target: {
            paragraph: "P41",
            selector: [
              { type: "TextQuoteSelector", exact: "evaluated on CIC-IDS2017" },
              { type: "PdfRectSelector", anchors: [{ page: 6, rect: [10, 20, 100, 30] }] },
            ],
          },
          created: "2026-11-21T00:00:00Z",
          modified: "2026-11-21T00:00:00Z",
        },
      ],
      notesMarkdown: "Great baseline for my PFE related-work chapter.",
      summary: {
        sentences: [{ text: "Proposes a robust 6G IDS.", citations: ["P1"], status: "supported" }],
      },
    });

    assert.ok(md.startsWith("---\ntitle: \"Adversarial Robustness in 6G Intrusion Detection\""));
    assert.ok(md.includes("🟥 **limitation** — p.6 (P41)"));
    assert.ok(md.includes("> evaluated on CIC-IDS2017"));
    assert.ok(md.includes("Great baseline for my PFE related-work chapter."));
    assert.ok(md.includes("AI-generated · Grounded"));
    assert.ok(md.includes("[P1]"));
  });

  it("exports valid escaped BibTeX entries for papers and collections", () => {
    assert.equal(makeCitationKey(SAMPLE_PAPER), "benali2024adversarial");
    const bib = exportPaperToBibtex(SAMPLE_PAPER);
    assert.ok(bib.startsWith("@article{benali2024adversarial,"));
    assert.ok(bib.includes("author = {Amina Benali and Karim Mansouri}"));
    assert.ok(bib.includes("journal = {IEEE S\\&P}"));
    assert.ok(bib.includes("doi = {10.1109/SP.2024.00012}"));

    const colBib = exportCollectionToBibtex([SAMPLE_PAPER]);
    assert.ok(colBib.endsWith("}\n"));
  });
});
