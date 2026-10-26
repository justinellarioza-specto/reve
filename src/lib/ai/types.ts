import type { Section } from "../text";

export type Mode = "teach" | "quiz" | "explain";
export type Excerpt = Section & { score?: number };

export type TutorState = {
  hint_level?: number;
  // Demo-tutor bookkeeping (ignored by the real model).
  stage?: "warmup" | "ask" | "why" | "explain" | "explain_fix" | "summary";
  expect?: string[];
  sentence?: string;
  label?: string;
  asked?: number;
  concept?: string;
};

export type TutorTurn = { reply: string; citations: string[]; state: TutorState };

export type TutorContext = {
  mode: Mode;
  topic: { title: string; summary: string };
  concepts: { name: string; description: string }[];
  material: Excerpt[]; // retrieved for this turn, best first
  topicMaterial: Excerpt[]; // all excerpts of the topic, in order (used by the demo tutor)
  history: { role: "user" | "assistant"; content: string; meta?: TutorState }[];
  userText: string | null; // null = write the opener
};

export type ExtractedTopic = {
  title: string;
  summary: string;
  labels: string[];
  concepts: { name: string; description: string }[];
};

export type GeneratedQuestion = {
  type: "mcq" | "tf" | "fill" | "spot_error";
  prompt: string;
  options: string[];
  answer: string;
  accept: string[];
  concept: string;
  hint: string;
  explanation: string;
  source_label: string;
};

export interface AIProvider {
  readonly name: string;
  readonly embedModel: string;
  embed(texts: string[], kind: "document" | "query"): Promise<number[][]>;
  tutor(ctx: TutorContext): Promise<TutorTurn>;
  extractTopics(subjectName: string, sections: Section[]): Promise<ExtractedTopic[]>;
  generateQuestions(input: {
    topicTitle: string;
    concepts: string[];
    material: Excerpt[];
    count: number;
  }): Promise<GeneratedQuestion[]>;
  traps(input: { subjectName: string; weak: string[]; missed: string[]; material: Excerpt[]; concepts: { topic: string; name: string; description: string }[] }): Promise<string>;
}

export const formatMaterial = (ex: Excerpt[], maxChars = 24_000) => {
  let out = "";
  for (const e of ex) {
    const block = `[${e.label}]\n${e.text}\n\n`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out.trim() || "(no material found for this topic)";
};
