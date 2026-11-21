import type { PdfRect } from "@kuraso/formats";

export interface PageMetrics {
  width: number;
  height: number;
  rotation?: 0 | 90 | 180 | 270;
  scale?: number;
}

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export declare function pdfToViewport(rect: PdfRect, metrics: PageMetrics): ViewportRect;
export declare function viewportToPdf(box: ViewportRect, metrics: PageMetrics): PdfRect;
export declare function normalizeToCropBox(absRect: PdfRect, cropBox: PdfRect): PdfRect;
