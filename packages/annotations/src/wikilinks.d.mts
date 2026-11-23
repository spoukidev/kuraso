export interface WikiLink {
  raw: string;
  target: string;
  alias: string;
  key: string;
  index: number;
}

export interface BacklinkEntry {
  sourceId: string;
  sourceTitle: string;
  snippet: string;
}

export interface NoteSource {
  id: string;
  title: string;
  markdown: string;
}

export declare function normalizeLinkKey(target: string): string;
export declare function extractWikiLinks(markdown: string): WikiLink[];
export declare function buildBacklinksIndex(
  notes: NoteSource[],
): Record<string, BacklinkEntry[]>;
