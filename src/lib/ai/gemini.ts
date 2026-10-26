import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { config, EMBED_DIM } from "../config";
import { prompt } from "../prompts";
import type { Section } from "../text";
import { formatMaterial, type AIProvider, type ExtractedTopic, type GeneratedQuestion, type TutorContext, type TutorTurn } from "./types";

const TutorOut = z.object({ reply: z.string(), citations: z.array(z.string()).default([]), hint_level: z.number().int().min(0).max(4).default(0) });
const TopicsOut = z.object({
  topics: z.array(
    z.object({
      title: z.string(),
      summary: z.string().default(""),
      labels: z.array(z.string()).default([]),
      concepts: z.array(z.object({ name: z.string(), description: z.string().default("") })).default([]),
    }),
  ),
});
const QuestionsOut = z.object({
  questions: z.array(
    z.object({
      type: z.enum(["mcq", "tf", "fill", "spot_error"]),
      prompt: z.string(),
      options: z.array(z.string()).default([]),
      answer: z.string(),
      accept: z.array(z.string()).default([]),
      concept: z.string().default(""),
      hint: z.string().default(""),
      explanation: z.string().default(""),
      source_label: z.string().default(""),
    }),
  ),
});

function jsonSchema(schema: z.ZodType) {
  const s = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

const MODE_NAMES = { teach: "Teach me", quiz: "Quiz me", explain: "Explain it back" } as const;
const OPENER_RULES = {
  teach: "Ask what the student already knows about the topic (or its first key concept). Invite a guess.",
  quiz: "Say it's a quick recall round in a few words, then ask the first short recall question from the material.",
  explain: "Ask the student to explain the first key concept in their own words, as if teaching a classmate.",
};

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly embedModel = config.geminiEmbedModel;
  private ai = new GoogleGenAI({ apiKey: config.geminiKey });

  private async json<T>(schema: z.ZodType<T>, contents: string | { role: string; parts: { text: string }[] }[], system?: string, temperature = 0.4): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.ai.models.generateContent({
          model: config.geminiModel,
          contents,
          config: {
            systemInstruction: system,
            temperature,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema(schema),
          },
        });
        return schema.parse(JSON.parse(res.text ?? "{}"));
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(`Gemini request failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
  }

  async embed(texts: string[], kind: "document" | "query"): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 50) {
      const batch = texts.slice(i, i + 50);
      const res = await this.ai.models.embedContent({
        model: this.embedModel,
        contents: batch,
        config: { outputDimensionality: EMBED_DIM, taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT" },
      });
      for (const e of res.embeddings ?? []) {
        const v = e.values ?? [];
        const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1; // re-normalize truncated vectors
        out.push(v.map((x) => x / n));
      }
    }
    return out;
  }

  async tutor(ctx: TutorContext): Promise<TutorTurn> {
    const concepts = ctx.concepts.map((c) => c.name).join(", ") || "(none listed)";
    const last = [...ctx.history].reverse().find((m) => m.role === "assistant");
    const hint = last?.meta?.hint_level ?? 0;
    if (ctx.userText === null) {
      const out = await this.json(
        TutorOut,
        prompt("opener", {
          mode_name: MODE_NAMES[ctx.mode],
          topic_title: ctx.topic.title,
          opener_rule: OPENER_RULES[ctx.mode],
          material: formatMaterial(ctx.topicMaterial, 8000),
        }),
        undefined,
        0.7,
      );
      return { reply: out.reply, citations: out.citations, state: { hint_level: 0 } };
    }
    const system = prompt("tutor", {
      hint_level: hint,
      mode_instructions: prompt(`modes/${ctx.mode}`),
      topic_title: ctx.topic.title,
      topic_summary: ctx.topic.summary,
      concepts,
      material: formatMaterial(ctx.material, 12_000),
    });
    // Gemini wants the conversation to start with a user turn and roles to alternate.
    const turns = [
      { role: "user", text: `(Start a ${MODE_NAMES[ctx.mode]} session on "${ctx.topic.title}".)` },
      ...ctx.history.slice(-16).map((m) => ({ role: m.role === "assistant" ? "model" : "user", text: m.content })),
      { role: "user", text: ctx.userText },
    ];
    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const t of turns) {
      const last = contents[contents.length - 1];
      if (last && last.role === t.role) last.parts[0].text += `\n\n${t.text}`;
      else contents.push({ role: t.role, parts: [{ text: t.text }] });
    }
    const out = await this.json(TutorOut, contents, system, 0.6);
    return { reply: out.reply, citations: out.citations, state: { hint_level: out.hint_level } };
  }

  async extractTopics(subjectName: string, sections: Section[]): Promise<ExtractedTopic[]> {
    // Keep the outline call bounded: trim each section and cap the total.
    const trimmed = sections.map((s) => ({ label: s.label, text: s.text.slice(0, 1200) }));
    const out = await this.json(TopicsOut, prompt("extract-topics", { subject_name: subjectName, material: formatMaterial(trimmed, 60_000) }));
    return out.topics.filter((t) => t.title.trim());
  }

  async generateQuestions(input: { topicTitle: string; concepts: string[]; material: Section[]; count: number }): Promise<GeneratedQuestion[]> {
    const out = await this.json(
      QuestionsOut,
      prompt("generate-questions", {
        count: input.count,
        topic_title: input.topicTitle,
        concepts: input.concepts.join(", "),
        material: formatMaterial(input.material, 16_000),
      }),
      undefined,
      0.5,
    );
    return out.questions;
  }

  async traps(input: { subjectName: string; weak: string[]; missed: string[]; material: Section[] }): Promise<string> {
    const res = await this.ai.models.generateContent({
      model: config.geminiModel,
      contents: prompt("traps", {
        subject_name: input.subjectName,
        weak: input.weak.join(", ") || "(none yet)",
        missed: input.missed.map((m) => `- ${m}`).join("\n") || "(none yet)",
        material: formatMaterial(input.material, 30_000),
      }),
      config: { temperature: 0.3 },
    });
    return (res.text ?? "").trim();
  }
}
