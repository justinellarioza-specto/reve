import "server-only";
import { isMockAI } from "../config";
import { MockProvider } from "./mock";
import type { AIProvider } from "./types";

let provider: AIProvider | null = null;

export async function getAI(): Promise<AIProvider> {
  if (provider) return provider;
  if (isMockAI()) provider = new MockProvider();
  else {
    const { GeminiProvider } = await import("./gemini");
    provider = new GeminiProvider();
  }
  return provider;
}

export function setAIForTests(p: AIProvider | null) {
  provider = p;
}

export * from "./types";
