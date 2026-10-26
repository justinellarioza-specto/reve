// End-to-end flow against a real (embedded) Postgres with the real schema and the demo AI.
import { beforeAll, describe, expect, it } from "vitest";
import { createPglite, setDbForTests } from "@/lib/db";
import * as repo from "@/lib/repo";
import { seedSampleSubject } from "@/lib/seed";
import { buildTraps, ensureQuestions, ingestDocument, openSession, retrieve, tutorTurn } from "@/lib/services";
import { makePptx } from "./fixtures";

const UID = "11111111-1111-4111-8111-111111111111";
let subjectId = "";

beforeAll(async () => {
  setDbForTests(await createPglite());
  await repo.ensureUser(UID, "test@example.com");
});

describe("seed", () => {
  it("creates a usable sample subject", async () => {
    subjectId = await seedSampleSubject(UID, "Asia/Manila");
    const subjects = await repo.listSubjects(UID);
    expect(subjects).toHaveLength(1);
    expect(subjects[0].exam_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const topics = await repo.listTopics(UID, subjectId);
    expect(topics.map((t) => t.title)).toEqual(["The OSI Model", "TCP vs UDP", "IPv4 Addressing"]);
    expect(topics.every((t) => t.question_count === 6 && t.concept_count === 3)).toBe(true);
  });
});

describe("retrieval", () => {
  it("finds the right slide for a question", async () => {
    const hits = await retrieve(UID, subjectId, null, "how many usable hosts in a /26 subnet", 3);
    expect(hits[0].label).toBe("Slide 11");
  });
});

describe("uploads", () => {
  it("turns a PPTX into topics, concepts and cited chunks", async () => {
    const data = await makePptx([
      { title: "Routing Protocols", body: "" },
      { title: "Static Routing", body: "A static route is configured manually by an administrator. Static routes do not adapt when the topology changes." },
      { title: "Dynamic Routing", body: "Dynamic routing protocols such as OSPF share routes automatically. OSPF is a link-state protocol that uses cost as its metric." },
      { title: "Administrative Distance", body: "Administrative distance ranks how trustworthy a route source is. A lower administrative distance is preferred by the router." },
    ]);
    const res = await ingestDocument(UID, subjectId, { filename: "routing.pptx", kind: "pptx", data });
    expect(res.topicCount).toBeGreaterThanOrEqual(1);
    const topics = await repo.listTopics(UID, subjectId);
    expect(topics.length).toBe(3 + res.topicCount);
    const newTopic = topics[3];
    const chunks = await repo.topicChunks(UID, newTopic.id);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => /^Slide \d+$/.test(c.source_label))).toBe(true);
    const qs = await ensureQuestions(UID, newTopic.id);
    expect(qs.length).toBeGreaterThanOrEqual(5);
    expect(qs.every((q) => q.concept_id)).toBe(true);
    for (const q of qs) {
      if (q.type === "mcq" || q.type === "spot_error") expect(q.options).toContain(q.answer);
      if (q.type === "fill") expect(q.prompt).toContain("_____");
    }
  });

  it("rejects files with no text", async () => {
    await expect(ingestDocument(UID, subjectId, { filename: "blank.txt", kind: "text", data: new TextEncoder().encode("  ") })).rejects.toThrow(/No text/);
  });
});

describe("Socratic chat", () => {
  it("opens with a question, never an answer, then climbs the hint ladder", async () => {
    const topic = (await repo.listTopics(UID, subjectId)).find((t) => t.title === "TCP vs UDP")!;
    const s = await openSession(UID, topic.id, "quiz");
    let msgs = await repo.listMessages(UID, s.id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("assistant");
    expect(msgs[0].content).toMatch(/\?/);
    expect(msgs[0].citations.length).toBe(1);

    const wrong1 = await tutorTurn(UID, s.id, "banana");
    expect(wrong1.meta.hint_level).toBe(1);
    const wrong2 = await tutorTurn(UID, s.id, "banana");
    expect(wrong2.meta.hint_level).toBe(2);
    const giveUp = await tutorTurn(UID, s.id, "just tell me");
    expect(giveUp.content).toMatch(/The answer is/);
    expect(giveUp.content).toMatch(/\?/); // follows up with a check question
    msgs = await repo.listMessages(UID, s.id);
    expect(msgs).toHaveLength(7);
  });

  it("says when something isn't in the material", async () => {
    const topic = (await repo.listTopics(UID, subjectId)).find((t) => t.title === "IPv4 Addressing")!;
    const s = await openSession(UID, topic.id, "teach");
    await tutorTurn(UID, s.id, "I know a bit about addresses");
    // answer the cloze correctly-ish or not; then ask an off-material question
    const s2 = await repo.createSession(UID, topic.id, "teach");
    await repo.addMessage(UID, s2.id, { role: "assistant", content: "What do you know?", meta: {} });
    const r = await tutorTurn(UID, s2.id, "What is the capital of Mongolia?");
    expect(r.content).toMatch(/can't find that in your material/);
  });
});

describe("attempts, mastery and review", () => {
  it("updates mastery and schedules misses for today", async () => {
    const topic = (await repo.listTopics(UID, subjectId))[0];
    const qs = await repo.topicQuestions(UID, topic.id);
    const now = new Date();
    const r1 = await repo.recordAttempt(UID, { question_id: qs[0].id, concept_id: qs[0].concept_id, correct: true, time_ms: 8000, hints_used: 0, mode: "check" }, now);
    expect(r1!.mastery).toBe(40);
    expect(r1!.due_at.getTime()).toBeGreaterThan(now.getTime() + 20 * 3600_000);
    const r2 = await repo.recordAttempt(UID, { question_id: qs[1].id, concept_id: qs[1].concept_id, correct: false, time_ms: 9000, hints_used: 1, mode: "check" }, now);
    expect(r2!.due_at.getTime() - now.getTime()).toBeLessThanOrEqual(10 * 60_000);

    const due = await repo.dueConcepts(UID, new Date(now.getTime() + 3600_000));
    expect(due.map((d) => d.concept_id)).toContain(qs[1].concept_id);
    const q = await repo.questionForConcept(UID, qs[1].concept_id!);
    expect(q).not.toBeNull();

    const weak = await repo.weakConcepts(UID);
    expect(weak.length).toBeGreaterThan(0);
    const days = await repo.activityDays(UID, "Asia/Manila");
    expect(days.length).toBe(1);
    const topics = await repo.listTopics(UID, subjectId);
    expect(topics[0].attempted).toBe(true);
    expect(topics[0].mastery).toBeGreaterThan(0);
  });

  it("builds a traps sheet that includes missed questions", async () => {
    const md = await buildTraps(UID, subjectId, true);
    expect(md).toMatch(/## Look-alikes/);
    expect(md).toMatch(/## Traps/);
  });
});

describe("outline editing", () => {
  it("renames, reorders and deletes topics", async () => {
    const before = await repo.listTopics(UID, subjectId);
    await repo.updateTopic(UID, before[1].id, { title: "Transport Layer", summary: "x" });
    await repo.moveTopic(UID, before[1].id, -1);
    const after = await repo.listTopics(UID, subjectId);
    expect(after[0].title).toBe("Transport Layer");
    await repo.deleteTopic(UID, after.at(-1)!.id);
    expect((await repo.listTopics(UID, subjectId)).length).toBe(before.length - 1);
  });

  it("scopes data by user", async () => {
    expect(await repo.getSubject("22222222-2222-4222-8222-222222222222", subjectId)).toBeNull();
  });
});
