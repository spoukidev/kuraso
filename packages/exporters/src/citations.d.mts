import type { PaperMeta } from "@kuraso/formats";

export type CitationStyle = "apa" | "ieee" | "acm";

export declare function formatCitation(paper: PaperMeta, style?: CitationStyle): string;
