import type { Annotation } from "@kuraso/formats";

const ANNOTATIONS_PREFIX = "kuraso:annotations:v1:";
const NOTES_PREFIX = "kuraso:notes:v1:";

export function loadPaperAnnotations(paperId: string): Annotation[] {
  try {
    const raw = localStorage.getItem(`${ANNOTATIONS_PREFIX}${paperId}`);
    return raw ? (JSON.parse(raw) as Annotation[]) : [];
  } catch {
    return [];
  }
}

/** Returns false when the browser storage refused the write (usually because it is full). */
export function savePaperAnnotations(paperId: string, annotations: Annotation[]): boolean {
  try {
    localStorage.setItem(`${ANNOTATIONS_PREFIX}${paperId}`, JSON.stringify(annotations));
    return true;
  } catch {
    return false;
  }
}

export function hasStoredAnnotations(paperId: string): boolean {
  try {
    return localStorage.getItem(`${ANNOTATIONS_PREFIX}${paperId}`) !== null;
  } catch {
    return false;
  }
}

export function hasStoredNotes(paperId: string): boolean {
  try {
    return localStorage.getItem(`${NOTES_PREFIX}${paperId}`) !== null;
  } catch {
    return false;
  }
}

/** Forget everything kept in browser storage for one paper. */
export function clearPaperStorage(paperId: string): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.endsWith(paperId) && key.startsWith("kuraso:")) localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

export function loadPaperNotes(paperId: string, fallbackTitle: string): string {
  try {
    const raw = localStorage.getItem(`${NOTES_PREFIX}${paperId}`);
    return raw !== null ? raw : `# ${fallbackTitle}\n\n`;
  } catch {
    return `# ${fallbackTitle}\n\n`;
  }
}

export function savePaperNotes(paperId: string, markdown: string): boolean {
  try {
    localStorage.setItem(`${NOTES_PREFIX}${paperId}`, markdown);
    return true;
  } catch {
    return false;
  }
}
