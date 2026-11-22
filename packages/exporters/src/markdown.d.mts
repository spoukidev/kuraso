import type { Annotation, PaperMeta } from "@kuraso/formats";

export interface SummaryForExport {
  sentences: { text: string; citations: string[]; status: string }[];
}

export declare function exportPaperToMarkdown(input: {
  paper: PaperMeta;
  annotations?: Annotation[];
  notesMarkdown?: string;
  summary?: SummaryForExport | null;
}): string;
