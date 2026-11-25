import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectIdentifiers, makePaperSlug } from "../src/identifiers.mjs";
import { parseArxivAtomXml } from "../src/metadata.mjs";

describe("@kuraso/importers identifier detection", () => {
  it("extracts DOI from first-page PDF text and strips trailing punctuation", () => {
    const sample = "Published in IEEE S&P 2024. DOI: 10.1109/SP54263.2024.00012. All rights reserved.";
    const res = detectIdentifiers(sample);
    assert.equal(res.doi, "10.1109/SP54263.2024.00012");
    assert.equal(res.arxivId, null);
  });

  it("extracts arXiv ID from URL, prefix, and bare format", () => {
    assert.equal(detectIdentifiers("https://arxiv.org/abs/1706.03762v7").arxivId, "1706.03762v7");
    assert.equal(detectIdentifiers("https://arxiv.org/pdf/2401.01234.pdf").arxivId, "2401.01234");
    assert.equal(detectIdentifiers("arXiv: 1512.03385 [cs.CV]").arxivId, "1512.03385");
    assert.equal(detectIdentifiers("2305.10601").arxivId, "2305.10601");
  });

  it("generates deterministic filesystem-safe paper slugs", () => {
    const slug = makePaperSlug({
      year: 2024,
      firstAuthor: "Amina Benali",
      title: "Adversarial Robustness in Intrusion Detection Systems",
      fileHash: "sha256:a1b2c3d4e5f60000",
    });
    assert.equal(slug, "2024-benali-adversarial-robustness-intrusion-a1b2c3");
  });
});

describe("@kuraso/importers arXiv Atom parser", () => {
  it("parses title, authors, year, abstract, and open-access PDF URL", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Attention Is All
            You Need</title>
          <summary>The dominant sequence transduction models are based on complex recurrent networks.</summary>
          <published>2017-06-12T17:57:34Z</published>
          <author><name>Ashish Vaswani</name></author>
          <author><name>Noam Shazeer</name></author>
        </entry>
      </feed>`;
    const meta = parseArxivAtomXml(xml, "1706.03762");
    assert.equal(meta.title, "Attention Is All You Need");
    assert.equal(meta.year, 2017);
    assert.equal(meta.venue, "arXiv");
    assert.equal(meta.authors.length, 2);
    assert.equal(meta.authors[0].name, "Ashish Vaswani");
    assert.equal(meta.openAccessPdfUrl, "https://arxiv.org/pdf/1706.03762.pdf");
  });
});

describe("@kuraso/importers metadata cleanup", () => {
  it("routes arXiv DOIs (10.48550/arXiv.*) to the arXiv lookup", async () => {
    const { detectIdentifiers } = await import("../src/identifiers.mjs");
    assert.equal(detectIdentifiers("10.48550/arXiv.1706.03762").arxivId, "1706.03762");
    assert.equal(detectIdentifiers("https://doi.org/10.48550/arXiv.2401.01234").arxivId, "2401.01234");
    assert.equal(detectIdentifiers("10.1109/SP54263.2024.00012").arxivId, null);
  });

  it("strips markup and decodes entities in titles and author names", async () => {
    const { cleanMetadataText, parseArxivAtomXml } = await import("../src/metadata.mjs");
    assert.equal(cleanMetadataText("Attention &amp; <i>Transformers</i>: a &#x3B1;-study"), "Attention & Transformers: a α-study");
    assert.equal(cleanMetadataText("<jats:p>First.</jats:p><jats:p>Second.</jats:p>"), "First. Second.");
    const meta = parseArxivAtomXml(
      "<feed><entry><title>Deep &amp; Wide</title><published>2017-06-12</published><author><name>A. B&amp;C</name></author></entry></feed>",
      "1706.03762",
    );
    assert.equal(meta.title, "Deep & Wide");
    assert.equal(meta.authors[0].name, "A. B&C");
  });
});
