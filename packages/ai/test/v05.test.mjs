import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCollectionPrompt, buildStudyPrompt, parseFlashcards } from "../src/v05.mjs";

describe("@kuraso/ai v0.5 multi-paper & study prompts", () => {
  it("builds grounded comparison-table prompts with [Paper#:P#] anchors", () => {
    const res = buildCollectionPrompt("comparison-table", {
      papers: [
        { id: "p1", title: "Paper One", year: 2023, abstract: "Uses CNN on CIC-IDS2017." },
        { id: "p2", title: "Paper Two", year: 2024, abstract: "Uses GNN on UNSW-NB15." },
      ],
      language: "en",
    });
    assert.ok(res.messages[1].content.includes("[Paper1:P1]"));
    assert.ok(res.messages[1].content.includes("[Paper2:P1]"));
    assert.ok(res.messages[1].content.includes("comparison table"));
  });

  it("parses Q/A flashcards with [P#] citations for Anki export", () => {
    const raw = `
Q: What dataset does the paper evaluate?
A: CIC-IDS2017 and UNSW-NB15 [P14]

Q: What is the main limitation?
A: Synthetic traffic only [P32]
`;
    const cards = parseFlashcards(raw);
    assert.equal(cards.length, 2);
    assert.equal(cards[0].question, "What dataset does the paper evaluate?");
    assert.equal(cards[0].answer, "CIC-IDS2017 and UNSW-NB15");
    assert.equal(cards[0].citation, "P14");
    assert.equal(cards[1].citation, "P32");
  });

  it("builds highlight-only summary prompts", () => {
    const res = buildStudyPrompt("summarize-highlights", {
      highlights: [{ quote: "99.1% F1 score", note: "Strong baseline", color: "blue", label: "result", page: 5 }],
    });
    assert.ok(res.messages[1].content.includes("[H1]"));
    assert.ok(res.messages[1].content.includes("99.1% F1 score"));
  });
});
