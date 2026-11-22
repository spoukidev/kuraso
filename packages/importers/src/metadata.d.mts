import type { Author } from "@kuraso/formats";

export interface FetchedMetadata {
  title: string;
  authors: Author[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  arxivId: string | null;
  url: string | null;
  abstract: string | null;
  openAccessPdfUrl: string | null;
}

export declare function fetchMetadataByDoi(
  doi: string,
  fetchImpl?: typeof fetch,
): Promise<FetchedMetadata>;

export declare function parseArxivAtomXml(xml: string, arxivId: string): FetchedMetadata;

export declare function fetchMetadataByArxiv(
  arxivId: string,
  fetchImpl?: typeof fetch,
): Promise<FetchedMetadata>;
