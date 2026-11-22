import type { Collection, PaperMeta, ReadingStatus } from "@kuraso/formats";
import { makePaperSlug } from "@kuraso/importers";

const PAPERS_KEY = "kuraso:library-papers:v1";
const COLLECTIONS_KEY = "kuraso:library-collections:v1";

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export function loadLibraryPapers(): PaperMeta[] {
  try {
    const raw = localStorage.getItem(PAPERS_KEY);
    return raw ? (JSON.parse(raw) as PaperMeta[]) : [];
  } catch {
    return [];
  }
}

export function saveLibraryPapers(papers: PaperMeta[]): void {
  try {
    localStorage.setItem(PAPERS_KEY, JSON.stringify(papers));
  } catch {
    // Ignore storage quota errors.
  }
}

export function loadLibraryCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    return raw ? (JSON.parse(raw) as Collection[]) : [];
  } catch {
    return [];
  }
}

export function saveLibraryCollections(collections: Collection[]): void {
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
  } catch {
    // Ignore.
  }
}

export function findDuplicatePaper(
  papers: PaperMeta[],
  fileHash: string,
  doi?: string | null,
): { paper: PaperMeta; reason: string } | null {
  for (const p of papers) {
    if (fileHash && p.fileHash === fileHash) {
      return { paper: p, reason: "identical file hash" };
    }
    if (doi && p.doi && p.doi.toLowerCase() === doi.toLowerCase()) {
      return { paper: p, reason: `matching DOI (${doi})` };
    }
  }
  return null;
}

export function createPaperRecord(input: {
  title: string;
  fileHash: string;
  authors?: { name: string; orcid?: string | null }[];
  year?: number | null;
  venue?: string | null;
  doi?: string | null;
  arxivId?: string | null;
  url?: string | null;
  abstract?: string | null;
  status?: ReadingStatus;
  scanned?: boolean;
}): PaperMeta {
  const now = new Date().toISOString();
  const slug = makePaperSlug({
    year: input.year,
    firstAuthor: input.authors?.[0]?.name ?? null,
    title: input.title,
    fileHash: input.fileHash,
  });

  return {
    id: `pap_${input.fileHash.replace(/^sha256:/, "").slice(0, 12)}`,
    slug,
    title: input.title,
    authors: input.authors ?? [],
    year: input.year ?? null,
    venue: input.venue ?? null,
    doi: input.doi ?? null,
    arxivId: input.arxivId ?? null,
    url: input.url ?? null,
    abstract: input.abstract ?? null,
    language: null,
    pageCount: null,
    fileHash: input.fileHash,
    scanned: input.scanned ?? false,
    status: input.status ?? "to-read",
    tags: [],
    readingPosition: null,
    addedAt: now,
    updatedAt: now,
    readAt: null,
  };
}

export function createCollectionRecord(name: string, parentId: string | null = null): Collection {
  const now = new Date().toISOString();
  return {
    id: `col_${Math.random().toString(36).slice(2, 10)}`,
    name: name.trim(),
    parentId,
    color: null,
    icon: null,
    localAiOnly: false,
    paperIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function filterPapersByQuery(
  papers: PaperMeta[],
  query: string,
  extractedTexts: Record<string, string>,
): PaperMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return papers;
  return papers.filter((p) => {
    const haystack = [
      p.title,
      p.venue ?? "",
      p.doi ?? "",
      p.arxivId ?? "",
      p.abstract ?? "",
      p.tags.join(" "),
      p.authors.map((a) => a.name).join(" "),
      extractedTexts[p.id] ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
