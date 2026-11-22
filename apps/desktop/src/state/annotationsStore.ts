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

export function savePaperAnnotations(paperId: string, annotations: Annotation[]): void {
  try {
    localStorage.setItem(`${ANNOTATIONS_PREFIX}${paperId}`, JSON.stringify(annotations));
  } catch {
    // Ignore storage quota errors.
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

export function savePaperNotes(paperId: string, markdown: string): void {
  try {
    localStorage.setItem(`${NOTES_PREFIX}${paperId}`, markdown);
  } catch {
    // Ignore.
  }
}
