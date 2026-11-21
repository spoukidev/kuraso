/**
 * Locked PDF <-> Viewport coordinate conversion for Kuraso.
 *
 * Stored PDF rect convention (`pdf-cropbox-points-bl-unrotated`):
 * - PDF user-space points, unscaled
 * - Relative to the page CropBox (so [0, 0] is CropBox bottom-left)
 * - Bottom-left origin, BEFORE page /Rotate is applied
 * - Normalized [x1, y1, x2, y2] with x1 < x2 and y1 < y2
 *
 * Viewport rect convention:
 * - Scaled CSS pixels relative to rendered page top-left
 * - { left, top, width, height }
 *
 * PageMetrics:
 * - width: CropBox width in PDF points (unrotated)
 * - height: CropBox height in PDF points (unrotated)
 * - rotation: 0 | 90 | 180 | 270 (clockwise degrees, matching PDF /Rotate)
 * - scale: zoom factor (CSS px per PDF point)
 */

function normalizeRotation(rotation) {
  const r = ((rotation % 360) + 360) % 360;
  if (r !== 0 && r !== 90 && r !== 180 && r !== 270) {
    throw new Error(`Unsupported PDF rotation: ${rotation}`);
  }
  return r;
}

/**
 * Convert a single point from CropBox-relative PDF points (bottom-left, unrotated)
 * into viewport CSS pixels (top-left, rotated + scaled).
 */
function pdfPointToViewport(x, y, { width, height, rotation = 0, scale = 1 }) {
  const r = normalizeRotation(rotation);
  switch (r) {
    case 0:
      return [x * scale, (height - y) * scale];
    case 90:
      // Clockwise 90°: bottom-left (0,0) -> top-left (0,0); top-left (0,H) -> top-right (H,0)
      return [y * scale, x * scale];
    case 180:
      return [(width - x) * scale, y * scale];
    case 270:
      return [(height - y) * scale, (width - x) * scale];
  }
}

/**
 * Convert a single point from viewport CSS pixels (top-left, rotated + scaled)
 * back into CropBox-relative PDF points (bottom-left, unrotated).
 */
function viewportPointToPdf(vx, vy, { width, height, rotation = 0, scale = 1 }) {
  const r = normalizeRotation(rotation);
  const px = vx / scale;
  const py = vy / scale;
  switch (r) {
    case 0:
      return [px, height - py];
    case 90:
      return [py, px];
    case 180:
      return [width - px, py];
    case 270:
      return [width - py, height - px];
  }
}

/**
 * Convert stored PDF rect [x1, y1, x2, y2] to viewport CSS box { left, top, width, height }.
 */
export function pdfToViewport(rect, metrics) {
  const [x1, y1, x2, y2] = rect;
  const p1 = pdfPointToViewport(x1, y1, metrics);
  const p2 = pdfPointToViewport(x2, y2, metrics);
  const left = Math.min(p1[0], p2[0]);
  const right = Math.max(p1[0], p2[0]);
  const top = Math.min(p1[1], p2[1]);
  const bottom = Math.max(p1[1], p2[1]);
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * Convert viewport CSS box { left, top, width, height } to stored PDF rect [x1, y1, x2, y2].
 */
export function viewportToPdf(box, metrics) {
  const p1 = viewportPointToPdf(box.left, box.top, metrics);
  const p2 = viewportPointToPdf(box.left + box.width, box.top + box.height, metrics);
  return [
    Math.min(p1[0], p2[0]),
    Math.min(p1[1], p2[1]),
    Math.max(p1[0], p2[0]),
    Math.max(p1[1], p2[1]),
  ];
}

/**
 * Normalize an absolute PDF MediaBox rect into CropBox-relative coordinates.
 * cropBox is [cx1, cy1, cx2, cy2] in PDF user-space points.
 */
export function normalizeToCropBox(absRect, cropBox) {
  const [x1, y1, x2, y2] = absRect;
  const [cx1, cy1] = cropBox;
  return [x1 - cx1, y1 - cy1, x2 - cx1, y2 - cy1];
}
