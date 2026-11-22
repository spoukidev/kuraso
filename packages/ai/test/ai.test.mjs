import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildGroundedContext,
  buildPromptMessages,
  estimateTokens,
  verifyGroundedResponse,
} from "../src/grounding.mjs";

const SAMPLE_PARAGRAPHS = [
  { id: "P1", section: "Abstract", text: "We propose a lightweight intrusion detection model for 6G edge nodes.", charStart: 0, charEnd: 70, anchors: [{ page: 1, rect: [0, 0, 100, 12] }] },
  { id: "P2", section: "Introduction", text: "Adversarial evasion attacks degrade standard classifiers by up to 40%.", charStart: 71, charEnd: 141, anchors: [{ page: 1, rect: [0, 0, 100, 12] }] },
  { id: "P3", section: "Experiments", text: "We evaluate on CIC-IDS2017 and UNSW-NB15 datasets using F1-score.", charStart: 142, charEnd: 207, anchors: [{ page: 4, rect: [0, 0, 100, 12] }] },
];

describe("@kuraso/ai grounding & programmatic citation verification", () => {
  it("strips hallucinated [P#] citations and flags unsupported sentences", () => {
    const validIds = new Set(["P1", "P2", "P3"]);
    const raw = [
      "## Key Results",
      "The authors evaluate on CIC-IDS2017 [P3].",
      "They claim zero false positives in production [P999].",
      "Adversarial attacks drop accuracy sharply [P2][P404].",
    ].join("\n");

    const res = verifyGroundedResponse(raw, validIds);
    assert.equal(res.strippedInvalidCount, 2);
    assert.equal(res.sentences[0].status, "heading");
    assert.deepEqual(res.sentences[1].citations, ["P3"]);
    assert.equal(res.sentences[1].status, "supported");

    // Hallucinated [P999] stripped -> sentence becomes unsupported!
    assert.deepEqual(res.sentences[2].citations, []);
    assert.equal(res.sentences[2].status, "unsupported");
    assert.ok(!res.sentences[2].text.includes("P999"));

    // Valid [P2] kept, hallucinated [P404] stripped
    assert.deepEqual(res.sentences[3].citations, ["P2"]);
    assert.equal(res.sentences[3].status, "supported");
  });

  it("detects explicit not-in-paper answers without false alarms", () => {
    const res = verifyGroundedResponse("The paper doesn't say this.", ["P1"]);
    assert.equal(res.notInPaper, true);
    assert.equal(res.sentences[0].status, "supported");
  });

  it("wraps paper text in <paper_data> boundaries and estimates input tokens", () => {
    const built = buildPromptMessages("chat", {
      paragraphs: SAMPLE_PARAGRAPHS,
      question: "What datasets are used?",
      language: "fr",
      style: "short",
    });
    assert.equal(built.messages.length, 2);
    assert.ok(built.messages[1].content.includes("<paper_data>"));
    assert.ok(built.messages[1].content.includes("[P3]"));
    assert.ok(built.estimatedInputTokens > 20);
    assert.equal(estimateTokens("12345678"), 2);
  });

  it("trims long papers with BM25-like keyword scoring while keeping opening paragraphs", () => {
    const longParas = Array.from({ length: 25 }, (_, i) => ({
      id: `P${i + 1}`,
      section: i === 20 ? "Datasets" : "Body",
      text: i === 20 ? "Special dataset CIC-IDS2017 details." : "Generic filler paragraph ".repeat(10),
      charStart: 0,
      charEnd: 100,
      anchors: [{ page: 1, rect: [0, 0, 100, 12] }],
    }));

    const res = buildGroundedContext(longParas, { maxChars: 1200, query: "CIC-IDS2017 dataset" });
    assert.equal(res.trimmed, true);
    assert.ok(res.includedIds.includes("P1"));
    assert.ok(res.includedIds.includes("P21"));
  });
});
