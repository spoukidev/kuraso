import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pdfToViewport, viewportToPdf, normalizeToCropBox } from "../src/coordinates.mjs";

const EPS = 1e-6;
function assertNear(a, b, msg = "") {
  assert.ok(Math.abs(a - b) < EPS, `${msg} expected ${a} ≈ ${b}`);
}

describe("@kuraso/reader coordinate conversions", () => {
  const sampleRect = [72.5, 410.25, 290.75, 422.5];
  const rotations = [0, 90, 180, 270];
  const scales = [0.75, 1, 1.5, 2.25];

  for (const rotation of rotations) {
    for (const scale of scales) {
      it(`round-trips cleanly at rotation=${rotation}° and scale=${scale}`, () => {
        const metrics = { width: 612, height: 792, rotation, scale };
        const vp = pdfToViewport(sampleRect, metrics);
        assert.ok(vp.width > 0 && vp.height > 0);
        const back = viewportToPdf(vp, metrics);
        for (let i = 0; i < 4; i++) {
          assertNear(back[i], sampleRect[i], `coord[${i}]`);
        }
      });
    }
  }

  it("flips Y axis cleanly at 0° rotation", () => {
    // Top-left corner of a 612x792 page in PDF points: [0, 780, 100, 792]
    const vp = pdfToViewport([0, 780, 100, 792], {
      width: 612,
      height: 792,
      rotation: 0,
      scale: 2,
    });
    assertNear(vp.left, 0);
    assertNear(vp.top, 0);
    assertNear(vp.width, 200);
    assertNear(vp.height, 24);
  });

  it("normalizes absolute MediaBox rects when CropBox != MediaBox", () => {
    const cropBox = [36, 54, 576, 738];
    const absRect = [108, 464, 326, 476];
    const rel = normalizeToCropBox(absRect, cropBox);
    assert.deepEqual(rel, [72, 410, 290, 422]);
  });

  it("rejects invalid PDF rotations", () => {
    assert.throws(
      () => pdfToViewport(sampleRect, { width: 612, height: 792, rotation: 45, scale: 1 }),
      /Unsupported PDF rotation/,
    );
  });
});
