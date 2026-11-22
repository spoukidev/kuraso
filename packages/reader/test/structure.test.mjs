import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectHeadingLevel, segmentPagesToStructure } from "../src/structure.mjs";

describe("@kuraso/reader heuristic structure extraction", () => {
  it("detects numbered and canonical academic headings", () => {
    assert.equal(detectHeadingLevel("Abstract", 11, 10), 1);
    assert.equal(detectHeadingLevel("1. Introduction", 11, 10), 1);
    assert.equal(detectHeadingLevel("2.1 Threat Model", 10, 10), 2);
    assert.equal(detectHeadingLevel("IV. Evaluation", 10, 10), 1);
    assert.equal(
      detectHeadingLevel("This is a normal sentence ending with a period.", 10, 10),
      null,
    );
  });

  it("segments pages into headings and sequential P1..Pn paragraphs", () => {
    const structure = segmentPagesToStructure([
      {
        page: 1,
        lines: [
          { text: "Abstract", fontHeight: 12, rect: [72, 700, 140, 712] },
          {
            text: "Intrusion detection systems face growing adversarial pressure in modern 6G networks.",
            fontHeight: 10,
            rect: [72, 670, 500, 682],
          },
          { text: "", fontHeight: 10 },
          { text: "1. Introduction", fontHeight: 12, rect: [72, 620, 200, 632] },
          {
            text: "We evaluate three robust defense strategies across two benchmark datasets.",
            fontHeight: 10,
            rect: [72, 590, 500, 602],
          },
        ],
      },
    ]);

    assert.equal(structure.parserVersion, 1);
    assert.equal(structure.coordinateSpace, "pdf-cropbox-points-bl-unrotated");
    assert.equal(structure.headings.length, 2);
    assert.equal(structure.headings[0].title, "Abstract");
    assert.equal(structure.headings[1].title, "1. Introduction");
    assert.equal(structure.paragraphs.length, 2);
    assert.equal(structure.paragraphs[0].id, "P1");
    assert.equal(structure.paragraphs[0].section, "Abstract");
    assert.equal(structure.paragraphs[1].id, "P2");
    assert.equal(structure.paragraphs[1].section, "1. Introduction");
  });
});
