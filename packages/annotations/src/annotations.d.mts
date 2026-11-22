import type {
  Annotation,
  AnnotationType,
  HighlightColor,
  PaperStructure,
  PdfAnchor,
} from "@kuraso/formats";

export declare const SEMANTIC_LABELS: Record<HighlightColor, string>;

export interface CreateAnnotationInput {
  type?: AnnotationType;
  color?: HighlightColor;
  label?: string | null;
  tags?: string[];
  note?: string | null;
  exact: string;
  prefix?: string;
  suffix?: string;
  charStart?: number;
  charEnd?: number;
  anchors?: PdfAnchor[];
  paragraph?: string | null;
}

export declare function createAnnotation(input: CreateAnnotationInput): Annotation;
export declare function getAnnotationQuote(ann: Annotation): string;
export declare function getAnnotationPage(ann: Annotation): number;
export declare function getAnnotationAnchors(ann: Annotation): PdfAnchor[];

export declare function remapAnnotationsToStructure(
  annotations: Annotation[],
  structure: PaperStructure,
): { remapped: Annotation[]; unmatchedIds: string[] };

export interface GatheringOptions {
  color?: HighlightColor | "all";
  tag?: string | "all";
  query?: string;
  groupBy?: "page" | "color" | "tag";
}

export declare function filterAndGroupAnnotations(
  annotations: Annotation[],
  options?: GatheringOptions,
): { group: string; items: Annotation[] }[];
