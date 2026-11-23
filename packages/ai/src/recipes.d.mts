import type { AIRecipe, Paragraph } from "@kuraso/formats";
import type { AnswerLanguage, ChatMessage } from "./grounding.mjs";

export declare const BUILTIN_RECIPES: AIRecipe[];

export declare function buildRecipePrompt(
  recipe: AIRecipe,
  input: { paragraphs: Paragraph[]; language?: AnswerLanguage },
): {
  messages: ChatMessage[];
  estimatedInputTokens: number;
  includedIds: string[];
  trimmed: boolean;
};
