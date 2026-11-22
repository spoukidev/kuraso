import type { PaperStructure, PdfRect } from "@kuraso/formats";

export interface ExtractedLine {
  text: string;
  fontHeight?: number;
  rect?: PdfRect;
}

export interface ExtractedPageLines {
  page: number;
  lines: ExtractedLine[];
}

export declare function detectHeadingLevel(
  line: string,
  fontHeight?: number,
  medianFontHeight?: number,
): number | null;

export declare function segmentPagesToStructure(pages: ExtractedPageLines[]): PaperStructure;
