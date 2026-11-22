export interface DetectedIdentifiers {
  doi: string | null;
  arxivId: string | null;
}

export interface SlugInput {
  year?: number | null;
  firstAuthor?: string | null;
  title?: string | null;
  fileHash: string;
}

export declare function detectIdentifiers(input: string): DetectedIdentifiers;
export declare function makePaperSlug(input: SlugInput): string;
