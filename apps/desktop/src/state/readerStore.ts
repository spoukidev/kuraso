import type { PaperStructure } from "@kuraso/formats";
import type { KurasoTheme } from "@kuraso/ui";

export interface OutlineNode {
  title: string;
  page: number;
  level: number;
  source?: "toc" | "heuristic";
}

export interface OpenDocumentTab {
  id: string;
  title: string;
  bytes: Uint8Array;
  pageCount: number;
  currentPage: number;
  zoom: number;
  marginCrop: boolean;
  scanned: boolean;
  outline: OutlineNode[];
  structure?: PaperStructure | null;
}

const POSITION_STORAGE_KEY = "kuraso:reading-positions:v1";
const THEME_STORAGE_KEY = "kuraso:theme:v1";

export function loadSavedPositions(): Record<string, number> {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function saveReadingPosition(docKey: string, page: number): void {
  try {
    const map = loadSavedPositions();
    map[docKey] = page;
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors in restricted webviews.
  }
}

export function loadSavedTheme(): KurasoTheme {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === "light" || val === "sepia" || val === "dark") {
      return val;
    }
  } catch {
    // Ignore.
  }
  return "light";
}

export function saveTheme(theme: KurasoTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore.
  }
}

/** Fast deterministic key for reading-position memory in Phase 1 (replaced by SHA-256 in Phase 2). */
export function makeDocumentKey(name: string, byteLength: number): string {
  return `${name}::${byteLength}`;
}
