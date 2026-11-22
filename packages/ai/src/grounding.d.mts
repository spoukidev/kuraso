import type { Paragraph } from "@kuraso/formats";

export type AITaskKind = "tldr" | "structured-summary" | "explain-selection" | "chat";
export type AnswerLanguage = "en" | "fr" | "ar" | "paper";
export type AnswerStyle = "short" | "balanced" | "detailed" | "beginner";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroundedSentence {
  text: string;
  citations: string[];
  status: "supported" | "unsupported" | "heading";
}

export interface GroundedAnswer {
  sentences: GroundedSentence[];
  notInPaper: boolean;
  strippedInvalidCount: number;
}

export declare function estimateTokens(text: string): number;

export declare function buildGroundedContext(
  paragraphs: Paragraph[],
  options?: { maxChars?: number; query?: string },
): { context: string; includedIds: string[]; trimmed: boolean };

export declare function buildPromptMessages(
  task: AITaskKind,
  input: {
    paragraphs: Paragraph[];
    selection?: string;
    question?: string;
    language?: AnswerLanguage;
    style?: AnswerStyle;
  },
): {
  messages: ChatMessage[];
  estimatedInputTokens: number;
  includedIds: string[];
  trimmed: boolean;
};

export declare function verifyGroundedResponse(
  rawText: string,
  validParagraphIds: Iterable<string>,
): GroundedAnswer;
