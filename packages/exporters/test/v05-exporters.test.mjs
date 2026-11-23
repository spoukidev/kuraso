import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCitation } from "../src/citations.mjs";
import { exportFlashcardsToAnkiTsv } from "../src/anki.mjs";

const PAPER = {
  title: "Adversarial Robustness in 6G IDS",
  authors: [{ name: "Amina Benali" }, { name: "Karim Mansouri" }],
  year: 2024,
  venue: "IEEE S&P",
  doi: "10.1109/SP.2024.00012",
  url: "https://doi.org/10.1109/SP.2024.00012",
};

describe("@kuraso/exporters v0.5 CSL Citations & Anki TSV", () => {
  it("formats APA, IEEE, and ACM citations cleanly", () => {
    const apa = formatCitation(PAPER, "apa");
    assert.ok(apa.includes("Benali, A., & Mansouri, K. (2024)."));
    assert.ok(apa.includes("https://doi.org/10.1109/SP.2024.00012"));

    const ieee = formatCitation(PAPER, "ieee");
    assert.ok(ieee.includes('A. Benali and K. Mansouri, "Adversarial Robustness in 6G IDS,"'));
    assert.ok(ieee.includes("doi: 10.1109/SP.2024.00012."));

    const acm = formatCitation(PAPER, "acm");
    assert.ok(acm.includes("Amina Benali, and Karim Mansouri. 2024."));
  });

  it("exports flashcards to Anki-importable TSV with citations", () => {
    const tsv = exportFlashcardsToAnkiTsv([
      {
        question: "Which datasets are evaluated?",
        answer: "CIC-IDS2017 and UNSW-NB15",
        citation: "P14",
        tags: ["kuraso", "ids"],
      },
    ]);
    assert.equal(tsv, "Which datasets are evaluated?\tCIC-IDS2017 and UNSW-NB15 [P14]\tkuraso ids\n");
  });
});
