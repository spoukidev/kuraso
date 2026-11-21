import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { searchPageTexts } from "../src/search.mjs";

describe("@kuraso/reader in-document search", () => {
  const pages = [
    { page: 1, text: "Intrusion detection systems (IDS) protect networks from adversarial attacks." },
    { page: 2, text: "We evaluate our IDS model on CIC-IDS2017 and UNSW-NB15 datasets." },
  ];

  it("finds case-insensitive matches across multiple pages", () => {
    const res = searchPageTexts(pages, "ids");
    assert.equal(res.length, 3);
    assert.equal(res[0].page, 1);
    assert.equal(res[1].page, 2);
    assert.equal(res[2].page, 2);
    assert.equal(res[2].indexInPage, 1);
  });

  it("returns empty array for empty or whitespace queries", () => {
    assert.deepEqual(searchPageTexts(pages, "   "), []);
  });
});
