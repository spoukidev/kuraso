import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBibtex } from "../src/bibtex.mjs";

describe("@kuraso/importers BibTeX / Zotero parser", () => {
  it("parses multiple BibTeX entries with authors, venue, DOI, and arXiv eprint", () => {
    const bib = `
@article{benali2024ids,
  title = {Adversarial Robustness in {6G} Intrusion Detection},
  author = {Benali, Amina and Mansouri, Karim},
  year = {2024},
  journal = {IEEE S\\&P},
  doi = {10.1109/SP.2024.00012}
}

@misc{vaswani2017attention,
  title = {Attention Is All You Need},
  author = {Ashish Vaswani and Noam Shazeer},
  year = {2017},
  eprint = {1706.03762},
  archivePrefix = {arXiv}
}
`;
    const parsed = parseBibtex(bib);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].title, "Adversarial Robustness in 6G Intrusion Detection");
    assert.equal(parsed[0].authors[0].name, "Amina Benali");
    assert.equal(parsed[0].venue, "IEEE S&P");
    assert.equal(parsed[0].doi, "10.1109/SP.2024.00012");
    assert.equal(parsed[1].arxivId, "1706.03762");
    assert.equal(parsed[1].openAccessPdfUrl, "https://arxiv.org/pdf/1706.03762.pdf");
  });
});
