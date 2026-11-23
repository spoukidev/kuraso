import type { Paragraph } from "@kuraso/formats";
import type { AnswerLanguage, ChatMessage } from "./grounding.mjs";

export interface CollectionPaperInput {
  id: string;
  title: string;
  year?: number | null;
  abstract?: string | null;
  paragraphs?: Paragraph[];
}

export interface HighlightSummaryInput {
  quote: string;
  note?: string | null;
  color: string;
  label?: string | null;
  page: number;
}

export interface ParsedFlashcard {
  question: string;
  answer: string;
  citation?: string;
  tags: string[];
}

export declare function buildCollectionPrompt(
  mode: "collection-chat" | "comparison-table",
  input: {
    papers: CollectionPaperInput[];
    question?: string;
    language?: AnswerLanguage;
  },
): { messages: ChatMessage[]; estimatedInputTokens: number };

export declare function buildStudyPrompt(
  mode: "summarize-highlights" | "translate" | "flashcards",
  input: {
    highlights?: HighlightSummaryInput[];
    selection?: string;
    targetLanguage?: "en" | "fr" | "ar";
    paragraphs?: Paragraph[];
  },
): { messages: ChatMessage[]; estimatedInputTokens: number };

export declare function parseFlashcards(rawText: string): ParsedFlashcard[];
