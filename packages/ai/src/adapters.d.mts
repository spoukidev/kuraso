import type { ProviderKind } from "@kuraso/formats";
import type { ChatMessage } from "./grounding.mjs";

export interface ProviderCallInput {
  kind: ProviderKind;
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export declare function callProviderChat(input: ProviderCallInput): Promise<{ text: string }>;

export declare function testProviderConnection(input: {
  kind: ProviderKind;
  baseUrl: string;
  apiKey?: string;
  model: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true }>;
