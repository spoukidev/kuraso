export interface PageTextEntry {
  page: number;
  text: string;
}

export interface SearchMatch {
  page: number;
  indexInPage: number;
  charIndex: number;
  length: number;
  snippet: string;
}

export declare function searchPageTexts(pages: PageTextEntry[], query: string): SearchMatch[];
