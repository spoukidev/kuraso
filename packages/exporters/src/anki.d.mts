export interface Flashcard {
  question: string;
  answer: string;
  citation?: string;
  tags?: string[];
}

export declare function exportFlashcardsToAnkiTsv(
  cards: Flashcard[],
  defaultTag?: string,
): string;
