import { describe, expect, it } from "vitest";
import { NEW_SCHEDULE, nextMastery, nextSchedule, qualityFrom, reviewMinutes } from "@/lib/srs";

const now = new Date("2026-10-26T12:00:00Z");
const DAY = 86_400_000;

describe("SM-2 schedule", () => {
  it("grows intervals 1 → 3 → ~ease× on successes", () => {
    let s = NEW_SCHEDULE(now);
    s = nextSchedule(s, 5, now);
    expect(s.interval_days).toBe(1);
    s = nextSchedule(s, 5, now);
    expect(s.interval_days).toBe(3);
    s = nextSchedule(s, 4, now);
    expect(s.interval_days).toBeGreaterThanOrEqual(7);
    expect(s.reps).toBe(3);
  });

  it("brings a missed concept back the same day and resets reps", () => {
    let s = nextSchedule(NEW_SCHEDULE(now), 5, now);
    s = nextSchedule(s, 5, now);
    const miss = nextSchedule(s, 1, now);
    expect(miss.reps).toBe(0);
    expect(miss.lapses).toBe(1);
    expect(miss.due_at.getTime() - now.getTime()).toBe(10 * 60_000);
    expect(miss.ease).toBeLessThan(s.ease);
  });

  it("never schedules past the day before the exam", () => {
    const exam = new Date(now.getTime() + 4 * DAY);
    let s = NEW_SCHEDULE(now);
    for (let i = 0; i < 4; i++) s = nextSchedule(s, 5, now, exam);
    expect(s.due_at.getTime()).toBeLessThanOrEqual(exam.getTime() - DAY);
  });

  it("ease never drops below 1.3", () => {
    let s = NEW_SCHEDULE(now);
    for (let i = 0; i < 20; i++) s = nextSchedule(s, 0, now);
    expect(s.ease).toBe(1.3);
  });

  it("maps attempts to quality", () => {
    expect(qualityFrom(true, 0, 5000)).toBe(5);
    expect(qualityFrom(true, 0, 60_000)).toBe(4);
    expect(qualityFrom(true, 2, 5000)).toBe(3);
    expect(qualityFrom(false, 0, 5000)).toBeLessThan(3);
  });
});

describe("mastery", () => {
  it("rises with correct answers, less with hints, and drops on misses", () => {
    expect(nextMastery(0, true, 0)).toBe(40);
    expect(nextMastery(0, true, 2)).toBeLessThan(40);
    expect(nextMastery(80, false, 0)).toBe(48);
    let m = 0;
    for (let i = 0; i < 10; i++) m = nextMastery(m, true, 0);
    expect(m).toBeGreaterThanOrEqual(99);
  });
  it("estimates review minutes", () => {
    expect(reviewMinutes(0)).toBe(0);
    expect(reviewMinutes(1)).toBe(1);
    expect(reviewMinutes(12)).toBe(9);
  });
});
