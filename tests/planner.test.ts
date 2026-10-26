import { describe, expect, it } from "vitest";
import { buildPlan } from "@/lib/planner";
import { streakFrom, diffDays, addDays } from "@/lib/dates";

const topics = ["A", "B", "C", "D", "E"].map((t, i) => ({ id: t, title: `Topic ${t}`, mastery: i === 4 ? 90 : 10 * i }));

describe("exam countdown plan", () => {
  it("covers every day up to the exam eve with short sessions", () => {
    const plan = buildPlan(topics, "2026-10-26", "2026-11-05");
    expect(plan.daysLeft).toBe(10);
    expect(plan.days).toHaveLength(10);
    expect(plan.days[0].date).toBe("2026-10-26");
    expect(plan.days.at(-1)!.date).toBe("2026-11-04");
    for (const d of plan.days) for (const s of d.sessions) expect(s.minutes).toBeLessThanOrEqual(30);
  });

  it("learns each unlearned topic once, then mixes topics near the exam", () => {
    const plan = buildPlan(topics, "2026-10-26", "2026-11-05");
    const learned = plan.days.flatMap((d) => d.sessions.filter((s) => s.kind === "learn").flatMap((s) => s.topicIds));
    expect(learned.sort()).toEqual(["A", "B", "C", "D"]); // E is already mastered
    const lastLearn = Math.max(...plan.days.map((d, i) => (d.sessions.some((s) => s.kind === "learn") ? i : -1)));
    const firstMixed = plan.days.findIndex((d) => d.sessions.some((s) => s.kind === "mixed"));
    expect(firstMixed).toBeGreaterThan(lastLearn);
    const mixed = plan.days[firstMixed].sessions.find((s) => s.kind === "mixed")!;
    expect(mixed.topicIds.length).toBeGreaterThanOrEqual(2);
    expect(mixed.topicIds[0]).toBe("A"); // weakest first
  });

  it("puts the traps sheet on the exam eve", () => {
    const plan = buildPlan(topics, "2026-10-26", "2026-11-05");
    const eve = plan.days.at(-1)!;
    expect(eve.isExamEve).toBe(true);
    expect(eve.sessions.map((s) => s.kind)).toContain("traps");
  });

  it("still fits everything when the exam is tomorrow", () => {
    const plan = buildPlan(topics, "2026-10-26", "2026-10-27");
    expect(plan.days).toHaveLength(1);
    const kinds = plan.days[0].sessions.map((s) => s.kind);
    expect(kinds.filter((k) => k === "learn")).toHaveLength(4);
    expect(kinds).toContain("traps");
  });

  it("handles missing or past exam dates", () => {
    expect(buildPlan(topics, "2026-10-26", null).days).toHaveLength(0);
    expect(buildPlan(topics, "2026-10-26", "2026-10-20").note).toMatch(/passed/);
    expect(buildPlan(topics, "2026-10-26", "2026-10-26").note).toMatch(/Exam day/);
  });
});

describe("dates", () => {
  it("counts streaks ending today or yesterday", () => {
    expect(streakFrom(["2026-10-24", "2026-10-25", "2026-10-26"], "2026-10-26")).toBe(3);
    expect(streakFrom(["2026-10-24", "2026-10-25"], "2026-10-26")).toBe(2);
    expect(streakFrom(["2026-10-23"], "2026-10-26")).toBe(0);
  });
  it("does day math", () => {
    expect(diffDays("2026-10-26", "2026-11-05")).toBe(10);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
