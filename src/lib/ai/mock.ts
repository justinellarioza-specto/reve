/**
 * Demo provider: no network, no API key. Rule-based but follows the same tutoring rules
 * (question first, one question at a time, hint ladder, cite the source, stay in the material).
 * It exists so the app is fully usable on first run; set GEMINI_API_KEY for the real tutor.
 */
import { answerMatches, cloze, cosine, keyTerm, lexicalEmbedding, sentences, shuffle, tokenize, type Section } from "../text";
import type { AIProvider, Excerpt, ExtractedTopic, GeneratedQuestion, TutorContext, TutorState, TutorTurn } from "./types";

type ClozeItem = { sentence: string; term: string; question: string; label: string };

const GIVE_UP = /\b(just tell me|tell me na|sabihin mo na|i give up|give up|idk|i don'?t know|ewan|di ko alam|hindi ko alam|no idea|pass)\b/i;
const HINT = /\b(hint|clue|help)\b/i;

function clozeItems(material: Excerpt[], prefer: string[]): ClozeItem[] {
  const items: ClozeItem[] = [];
  for (const ex of material) {
    for (const s of sentences(ex.text)) {
      const term = keyTerm(s, prefer);
      if (!term || term.length < 3) continue;
      const q = cloze(s, term);
      if (q) items.push({ sentence: s, term, question: q, label: ex.label });
    }
  }
  return items;
}

const overlap = (a: string, b: string) => {
  const A = new Set(tokenize(a));
  return tokenize(b).filter((t) => A.has(t));
};

export class MockProvider implements AIProvider {
  readonly name = "demo";
  readonly embedModel = "lexical-v1";

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => lexicalEmbedding(t));
  }

  async tutor(ctx: TutorContext): Promise<TutorTurn> {
    const names = ctx.concepts.map((c) => c.name);
    const items = clozeItems(ctx.topicMaterial, names);
    const lastA = [...ctx.history].reverse().find((m) => m.role === "assistant");
    const st: TutorState = lastA?.meta ?? {};
    const asked = st.asked ?? 0;
    const first = ctx.concepts[0];

    const ask = (i: number, lead = ""): TutorTurn => {
      const it = items.length ? items[i % items.length] : null;
      if (!it) {
        return {
          reply: `${lead}I couldn't find enough detail in your material for this topic to quiz you on. Try uploading the slides or notes for "${ctx.topic.title}".`.trim(),
          citations: [],
          state: { stage: "ask", asked: i },
        };
      }
      return {
        reply: `${lead}Fill the gap from your ${it.label.toLowerCase().startsWith("slide") ? "slides" : "notes"}: "${it.question}" What goes in the blank?`.trim(),
        citations: [it.label],
        state: { stage: "ask", expect: [it.term], sentence: it.sentence, label: it.label, hint_level: 0, asked: i + 1 },
      };
    };

    // ── Opener: always a question, never the answer.
    if (ctx.userText === null) {
      if (ctx.mode === "teach")
        return {
          reply: `Let's work through ${ctx.topic.title}. Before I explain anything: what do you already know about ${first ? first.name : "this topic"}? A guess is totally fine.`,
          citations: [],
          state: { stage: "warmup", asked: 0 },
        };
      if (ctx.mode === "explain")
        return {
          reply: `Explain ${first ? first.name : ctx.topic.title} to me like you're teaching a classmate. What is it, and why does it matter?`,
          citations: [],
          state: { stage: "explain", concept: first?.name, asked: 0 },
        };
      return ask(0, "Quick recall round — answer from memory. ");
    }

    const text = ctx.userText.trim();

    // ── Explain it back.
    if (ctx.mode === "explain" && (st.stage === "explain" || st.stage === "explain_fix" || st.stage === "summary")) {
      const idx = Math.max(0, ctx.concepts.findIndex((c) => c.name === st.concept));
      const concept = ctx.concepts[idx] ?? first;
      if (st.stage === "summary") {
        const next = ctx.concepts[(idx + 1) % Math.max(1, ctx.concepts.length)];
        return {
          reply: `That's a clear summary — nice work putting it in your own words. Next: explain ${next?.name ?? "the next idea"} the same way.`,
          citations: [],
          state: { stage: "explain", concept: next?.name, asked: asked + 1 },
        };
      }
      const ref = `${concept?.description ?? ""} ${ctx.material.slice(0, 2).map((m) => m.text).join(" ")}`;
      const hit = [...new Set(overlap(text, ref))].slice(0, 4);
      const keyTerms = [...new Set(tokenize(concept?.description ?? ""))].filter((t) => t.length > 4 && !hit.includes(t));
      const missing = keyTerms[0];
      const cite = ctx.material[0]?.label;
      if (st.stage === "explain" && missing) {
        return {
          reply: `${hit.length ? `Good — you brought up ${hit.map((h) => `"${h}"`).join(", ")}.` : "Thanks for giving it a go."} One piece is missing: where does "${missing}" fit into ${concept?.name}? Try explaining that part again.`,
          citations: cite ? [cite] : [],
          state: { stage: "explain_fix", concept: concept?.name, asked },
        };
      }
      return {
        reply: `Better — that covers the core of ${concept?.name}. Now give me a one-sentence summary you could write on an exam.`,
        citations: cite ? [cite] : [],
        state: { stage: "summary", concept: concept?.name, asked },
      };
    }

    // ── Warm-up answer in Teach me.
    if (st.stage === "warmup") {
      const ref = ctx.concepts.map((c) => `${c.name} ${c.description}`).join(" ");
      const hit = [...new Set(overlap(text, ref))].slice(0, 3);
      const lead = hit.length
        ? `Good start — you mentioned ${hit.map((h) => `"${h}"`).join(", ")}. Let's check that against your material. `
        : "Thanks — that gives me a starting point. Let's build it up from your material. ";
      return ask(asked, lead);
    }

    // ── Answering a "why" follow-up.
    if (st.stage === "why") {
      return ask(asked, "Nice reasoning — explaining the why is what makes it stick. ");
    }

    // ── Answering a gap-fill question: check, then climb the hint ladder.
    if (st.stage === "ask" && st.expect?.length) {
      const term = st.expect[0];
      const correct = answerMatches(text, st.expect) || (text.length < 60 && text.toLowerCase().includes(term.toLowerCase()));
      const hint = st.hint_level ?? 0;
      if (correct) {
        if (ctx.mode === "teach" && asked % 2 === 1) {
          return {
            reply: `Yes — "${term}" (${st.label}). Now the important part: in your own words, why is that true?`,
            citations: st.label ? [st.label] : [],
            state: { stage: "why", asked },
          };
        }
        return ask(asked, `Correct — "${term}" (${st.label}). `);
      }
      const giveUp = GIVE_UP.test(text);
      const level = giveUp ? 4 : hint + 1;
      const keep = { ...st, hint_level: level };
      if (level === 1 && !HINT.test(text))
        return {
          reply: `Not quite. Read the sentence again — what would have to be true for it to make sense? Look at the words right before the blank.`,
          citations: st.label ? [st.label] : [],
          state: keep,
        };
      if (level <= 2)
        return {
          reply: `Here's a narrower hint: the missing term starts with "${term[0].toUpperCase()}" and has ${term.length} characters. What is it?`,
          citations: st.label ? [st.label] : [],
          state: { ...keep, hint_level: 2 },
        };
      if (level === 3)
        return {
          reply: `Almost there — it begins "${term.slice(0, Math.ceil(term.length / 2))}…". Give it one more try.`,
          citations: st.label ? [st.label] : [],
          state: keep,
        };
      const next = ask(asked, "");
      return {
        reply: `${giveUp ? "No problem — here it is." : "Let's look at it together."} The answer is "${term}". From ${st.label}: "${st.sentence}" Now try applying it: ${next.reply.replace(/^Fill the gap/, "fill the gap")}`,
        citations: [...new Set([st.label!, ...next.citations].filter(Boolean))],
        state: next.state,
      };
    }

    // ── Free-form question from the student: stay inside the material.
    const qv = lexicalEmbedding(text);
    const best = [...ctx.material, ...ctx.topicMaterial]
      .map((m) => ({ ...m, score: cosine(qv, lexicalEmbedding(m.text)) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!best || best.score < 0.12) {
      return {
        reply: `I can't find that in your material for this topic, so I won't guess. Want to keep going with what's in your notes instead?`,
        citations: [],
        state: { ...st, stage: st.stage ?? "warmup" },
      };
    }
    const s = sentences(best.text)[0] ?? best.text.slice(0, 160);
    return {
      reply: `Your material covers that in ${best.label}. Before I say more — based on this line, what do you think the answer is? "${s.slice(0, 180)}"`,
      citations: [best.label],
      state: { stage: "why", asked },
    };
  }

  async extractTopics(_subject: string, sections: Section[]): Promise<ExtractedTopic[]> {
    const groups: { title: string; secs: Section[] }[] = [];
    const firstLine = (s: Section) => s.text.split("\n")[0].trim();
    for (const s of sections) {
      const head = firstLine(s);
      const isDivider = s.text.length < 80 && s.text.split("\n").filter(Boolean).length <= 2 && head.split(/\s+/).length <= 8;
      const isHeading = s.label.startsWith("Section: ");
      const cur = groups[groups.length - 1];
      if (!cur || isDivider || (isHeading && cur.secs.length >= 2) || cur.secs.length >= 4) {
        groups.push({ title: isHeading ? s.label.replace("Section: ", "") : head, secs: [s] });
      } else cur.secs.push(s);
    }
    return groups.slice(0, 12).map((g) => {
      const title = g.title.split(/\s+/).slice(0, 6).join(" ").replace(/[:.]$/, "") || "Untitled topic";
      const concepts: { name: string; description: string }[] = [];
      for (const s of g.secs) {
        const lines = s.text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) continue; // title-only slide
        const name = lines[0]?.split(/\s+/).slice(0, 5).join(" ").replace(/[:.]$/, "");
        const desc = sentences(lines.slice(1).join(" "))[0] ?? "";
        if (name && desc && !concepts.some((c) => c.name === name)) concepts.push({ name, description: desc });
      }
      if (concepts.length === 0) {
        for (const sen of sentences(g.secs.map((s) => s.text).join("\n")).slice(0, 3)) {
          const t = keyTerm(sen);
          if (t && !concepts.some((c) => c.name === t)) concepts.push({ name: t, description: sen });
        }
      }
      return {
        title,
        summary: sentences(g.secs.map((s) => s.text).join("\n"))[0] ?? "",
        labels: g.secs.map((s) => s.label),
        concepts: concepts.slice(0, 5),
      };
    });
  }

  async generateQuestions(input: { topicTitle: string; concepts: string[]; material: Excerpt[]; count: number }): Promise<GeneratedQuestion[]> {
    const items = clozeItems(input.material, input.concepts);
    const terms = [...new Set(items.map((i) => i.term))];
    const conceptFor = (s: string) =>
      input.concepts.map((c) => ({ c, n: overlap(c, s).length })).sort((a, b) => b.n - a.n)[0]?.c ?? input.concepts[0] ?? "";
    const qs: GeneratedQuestion[] = [];
    const types: GeneratedQuestion["type"][] = ["fill", "mcq", "tf", "spot_error"];
    items.slice(0, input.count * 2).forEach((it, i) => {
      if (qs.length >= input.count) return;
      const others = shuffle(terms.filter((t) => t.toLowerCase() !== it.term.toLowerCase()), i / 7 + 0.1);
      const type = types[i % types.length];
      const base = { concept: conceptFor(it.sentence), source_label: it.label, accept: [] as string[] };
      if (type === "fill" || others.length === 0) {
        qs.push({ ...base, type: "fill", prompt: it.question, options: [], answer: it.term, hint: `It starts with "${it.term[0]}".`, explanation: `${it.label} says: "${it.sentence}"` });
      } else if (type === "mcq" && others.length >= 2) {
        qs.push({
          ...base,
          type: "mcq",
          prompt: `Which term completes this? "${it.question}"`,
          options: shuffle([it.term, ...others.slice(0, 3)], i / 3 + 0.2),
          answer: it.term,
          hint: "Picture the sentence with each option — which one is actually what your material says?",
          explanation: `${it.label} says: "${it.sentence}" The other options are terms from this topic used elsewhere.`,
        });
      } else if (type === "tf") {
        const falseVersion = i % 2 === 0 && others[0];
        qs.push({
          ...base,
          type: "tf",
          prompt: falseVersion ? it.sentence.replace(it.term, others[0]) : it.sentence,
          options: ["true", "false"],
          answer: falseVersion ? "false" : "true",
          hint: `Check the key term in this statement against ${it.label}.`,
          explanation: falseVersion ? `False — it's "${it.term}", not "${others[0]}". ${it.label}: "${it.sentence}"` : `True — this is straight from ${it.label}.`,
        });
      } else {
        const wrong = others[0];
        const statement = it.sentence.replace(it.term, wrong);
        const decoys = (statement.match(/\b[\p{L}][\p{L}-]{4,}\b/gu) ?? []).filter((w) => w !== wrong);
        const options = shuffle([wrong, ...shuffle([...new Set(decoys)], i / 5 + 0.3).slice(0, 2)], i / 11 + 0.4);
        qs.push({
          ...base,
          type: "spot_error",
          prompt: statement,
          options,
          answer: wrong,
          hint: "One term has been swapped with a look-alike from the same topic.",
          explanation: `It should be "${it.term}", not "${wrong}". ${it.label}: "${it.sentence}"`,
        });
      }
    });
    return qs;
  }

  async traps(input: { subjectName: string; weak: string[]; missed: string[]; concepts: { topic: string; name: string; description: string }[] }): Promise<string> {
    const byTopic = new Map<string, { name: string; description: string }[]>();
    for (const c of input.concepts) byTopic.set(c.topic, [...(byTopic.get(c.topic) ?? []), c]);
    const pairs: string[] = [];
    for (const [, cs] of byTopic) for (let i = 0; i + 1 < cs.length && pairs.length < 5; i += 2) pairs.push(`- **${cs[i].name} vs ${cs[i + 1].name}** — ${cs[i].description} / ${cs[i + 1].description}`);
    const traps = input.missed.slice(0, 6).map((m) => `- ${m}`);
    const remember = [...byTopic].map(([t, cs]) => `- **${t}:** ${cs[0]?.description ?? ""}`);
    return [
      `## Look-alikes`,
      pairs.join("\n") || "- Not enough concepts yet — finish a few Quick Checks first.",
      ``,
      `## Traps`,
      traps.join("\n") || (input.weak.length ? input.weak.map((w) => `- Double-check **${w}** — it's one of your weakest concepts.`).join("\n") : "- No missed questions yet. Do a mixed round so Reve can find your traps."),
      ``,
      `## If you remember one thing`,
      remember.join("\n"),
    ].join("\n");
  }
}
