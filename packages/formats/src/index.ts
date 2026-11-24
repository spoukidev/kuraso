/**
 * @kuraso/formats — MIT-licensed file-format types & constants for Kuraso.
 *
 * Coordinate convention (locked):
 * Every stored rectangle uses PDF user-space points, unscaled, relative to
 * the page CropBox, bottom-left origin, before /Rotate:
 *   [x1, y1, x2, y2] where x1 < x2 and y1 < y2.
 */

export const KURASO_APP_ID = "org.kuraso.desktop";
export const KURASO_URL_SCHEME = "kuraso";
export const KURASO_DEFAULT_LIBRARY_DIR = "Documents/Kuraso";
export const KURASO_FORMAT_VERSION = "1.0.0";
export const KURASO_COORDINATE_SPACE = "pdf-cropbox-points-bl-unrotated" as const;

export type CoordinateSpace = typeof KURASO_COORDINATE_SPACE;

/** [x1, y1, x2, y2] in PDF user-space points, CropBox-relative, bottom-left origin, unrotated. */
export type PdfRect = [number, number, number, number];

export interface PdfAnchor {
  page: number;
  rect: PdfRect;
  /** Source text of this run (paragraph anchors only); used to map Reflow selections to the PDF. */
  text?: string;
}

export interface KurasoLibraryMarker {
  libraryId: string;
  formatVersion: string;
  name?: string;
  createdAt: string;
}

export interface Collection {
  id: string;
  name: string;
  parentId: string | null;
  color?: string | null;
  icon?: string | null;
  localAiOnly?: boolean;
  paperIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionsFile {
  version: number;
  collections: Collection[];
}

export type ReadingStatus = "to-read" | "reading" | "read" | "skimmed" | "important";

export interface Author {
  name: string;
  orcid?: string | null;
}

export interface ReadingPosition {
  page: number;
  scrollRatio: number;
}

export interface PaperMeta {
  id: string;
  slug: string;
  title: string;
  authors: Author[];
  year?: number | null;
  venue?: string | null;
  doi?: string | null;
  arxivId?: string | null;
  url?: string | null;
  abstract?: string | null;
  language?: string | null;
  pageCount?: number | null;
  fileHash: string;
  scanned: boolean;
  status: ReadingStatus;
  tags: string[];
  readingPosition?: ReadingPosition | null;
  addedAt: string;
  updatedAt: string;
  readAt?: string | null;
}

export interface Heading {
  id: string;
  title: string;
  level: number;
  page: number;
  paragraphId?: string | null;
  source: "toc" | "heuristic" | "grobid" | "manual";
}

export interface Paragraph {
  id: string;
  section: string;
  text: string;
  charStart: number;
  charEnd: number;
  anchors: PdfAnchor[];
}

export interface PaperStructure {
  parserVersion: number;
  coordinateSpace: CoordinateSpace;
  pageCount: number;
  headings: Heading[];
  paragraphs: Paragraph[];
  generatedAt: string;
}

export type AnnotationType = "highlight" | "underline" | "strikethrough" | "note";
export type HighlightColor = "yellow" | "green" | "blue" | "red" | "purple";

export type AnnotationSelector =
  | { type: "TextQuoteSelector"; exact: string; prefix?: string; suffix?: string }
  | { type: "TextPositionSelector"; start: number; end: number }
  | { type: "PdfRectSelector"; anchors: PdfAnchor[] };

export interface Annotation {
  id: string;
  type: AnnotationType;
  color: HighlightColor;
  label?: string | null;
  tags: string[];
  note?: string | null;
  target: {
    paragraph?: string | null;
    selector: AnnotationSelector[];
  };
  created: string;
  modified: string;
}

export interface AnnotationsFile {
  version: number;
  coordinateSpace: CoordinateSpace;
  annotations: Annotation[];
}

export type ProviderKind = "openai-compatible" | "anthropic" | "ollama";

export interface ProviderPreset {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  freeTier: boolean;
  needsCard: boolean;
  local?: boolean;
  minRecommendedRamGb?: number;
  lastChecked: string;
  rateLimitsNote?: string;
  keyGuideUrl: string;
  defaultModel: string;
  recommendedModels: string[];
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  collectionIds: string[];
  draftMarkdown?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsFile {
  version: number;
  projects: Project[];
}

export interface AIRecipe {
  id: string;
  name: string;
  description?: string | null;
  promptTemplate: string;
  builtIn?: boolean;
}

export interface RecipesFile {
  version: number;
  recipes: AIRecipe[];
}
