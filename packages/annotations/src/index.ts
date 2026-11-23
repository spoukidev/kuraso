export {
  SEMANTIC_LABELS,
  createAnnotation,
  getAnnotationQuote,
  getAnnotationPage,
  getAnnotationAnchors,
  remapAnnotationsToStructure,
  filterAndGroupAnnotations,
} from "./annotations.mjs";
export type { CreateAnnotationInput, GatheringOptions } from "./annotations.mjs";
export {
  normalizeLinkKey,
  extractWikiLinks,
  buildBacklinksIndex,
} from "./wikilinks.mjs";
export type { WikiLink, BacklinkEntry, NoteSource } from "./wikilinks.mjs";
