export { detectIdentifiers, makePaperSlug } from "./identifiers.mjs";
export type { DetectedIdentifiers, SlugInput } from "./identifiers.mjs";
export {
  fetchMetadataByDoi,
  fetchMetadataByArxiv,
  parseArxivAtomXml,
} from "./metadata.mjs";
export type { FetchedMetadata } from "./metadata.mjs";
