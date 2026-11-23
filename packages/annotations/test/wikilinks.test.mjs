import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildBacklinksIndex, extractWikiLinks, normalizeLinkKey } from "../src/wikilinks.mjs";

describe("@kuraso/annotations v1.0 [[wiki-links]] & backlinks", () => {
  it("extracts [[Target]] and [[Target|Alias]] links cleanly", () => {
    const md = "See [[Adversarial IDS]] and [[Attention Is All You Need|Vaswani 2017]] for baselines.";
    const links = extractWikiLinks(md);
    assert.equal(links.length, 2);
    assert.equal(links[0].target, "Adversarial IDS");
    assert.equal(links[0].alias, "Adversarial IDS");
    assert.equal(links[1].target, "Attention Is All You Need");
    assert.equal(links[1].alias, "Vaswani 2017");
  });

  it("builds a bidirectional backlinks index across paper and project notes", () => {
    const idx = buildBacklinksIndex([
      { id: "p1", title: "Paper A", markdown: "Extends [[Paper B]] on CIC-IDS2017." },
      { id: "proj1", title: "PFE Thesis Draft", markdown: "Both [[Paper A]] and [[Paper B|B2024]] fail on zero-days." },
    ]);

    const bKey = normalizeLinkKey("Paper B");
    assert.equal(idx[bKey].length, 2);
    assert.equal(idx[bKey][0].sourceId, "p1");
    assert.equal(idx[bKey][1].sourceId, "proj1");
  });
});
