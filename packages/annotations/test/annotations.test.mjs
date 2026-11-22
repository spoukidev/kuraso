import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createAnnotation,
  filterAndGroupAnnotations,
  getAnnotationPage,
  getAnnotationQuote,
  remapAnnotationsToStructure,
} from "../src/annotations.mjs";

describe("@kuraso/annotations W3C model & re-mapping", () => {
  it("creates a dual-anchored W3C Web Annotation with normalized tags", () => {
    const ann = createAnnotation({
      color: "red",
      tags: ["limitation", "#dataset"],
      note: "Small sample size",
      exact: "we evaluate on CIC-IDS2017",
      prefix: "In this section, ",
      suffix: " and UNSW-NB15",
      anchors: [{ page: 6, rect: [72, 410, 290, 422] }],
      paragraph: "P41",
    });

    assert.match(ann.id, /^ann_/);
    assert.equal(ann.label, "limitation");
    assert.deepEqual(ann.tags, ["#limitation", "#dataset"]);
    assert.equal(getAnnotationQuote(ann), "we evaluate on CIC-IDS2017");
    assert.equal(getAnnotationPage(ann), 6);
    assert.equal(ann.target.selector.length, 3);
  });

  it("remaps annotations onto a re-parsed structure via TextQuoteSelector", () => {
    const ann1 = createAnnotation({
      exact: "adversarial examples degrade accuracy",
      paragraph: "P10",
      anchors: [{ page: 2, rect: [50, 300, 200, 312] }],
    });
    const ann2 = createAnnotation({
      exact: "quote that no longer exists after OCR fix",
      paragraph: "P11",
      anchors: [{ page: 3, rect: [50, 300, 200, 312] }],
    });

    const newStructure = {
      parserVersion: 2,
      coordinateSpace: "pdf-cropbox-points-bl-unrotated",
      pageCount: 4,
      headings: [],
      paragraphs: [
        {
          id: "P15",
          section: "Results",
          text: "We observe that adversarial examples degrade accuracy by 18%.",
          charStart: 0,
          charEnd: 61,
          anchors: [{ page: 2, rect: [50, 300, 250, 312] }],
        },
      ],
      generatedAt: new Date().toISOString(),
    };

    const { remapped, unmatchedIds } = remapAnnotationsToStructure([ann1, ann2], newStructure);
    assert.equal(remapped[0].target.paragraph, "P15");
    assert.deepEqual(unmatchedIds, [ann2.id]);
  });

  it("filters and groups annotations for Annotation Gathering", () => {
    const a1 = createAnnotation({ color: "yellow", tags: ["#baseline"], exact: "Idea A", anchors: [{ page: 1, rect: [0, 0, 10, 10] }] });
    const a2 = createAnnotation({ color: "red", tags: ["#limitation"], exact: "Flaw B", anchors: [{ page: 4, rect: [0, 0, 10, 10] }] });

    const byColor = filterAndGroupAnnotations([a1, a2], { groupBy: "color" });
    assert.equal(byColor.length, 2);

    const onlyRed = filterAndGroupAnnotations([a1, a2], { color: "red" });
    assert.equal(onlyRed.length, 1);
    assert.equal(onlyRed[0].items[0].id, a2.id);
  });
});
