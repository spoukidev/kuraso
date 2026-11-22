import type { PaperMeta } from "@kuraso/formats";

export declare function makeCitationKey(paper: PaperMeta): string;
export declare function exportPaperToBibtex(paper: PaperMeta): string;
export declare function exportCollectionToBibtex(papers: PaperMeta[]): string;
