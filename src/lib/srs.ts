/**
 * Spaced repetition (SM-2 variant tuned for exam prep).
 * - Misses come back the same day (10 min) and reset the interval.
 * - Successes grow the interval by the ease factor.
 * - Nothing is scheduled past the day before the exam, so everything gets one last look.
 */
export type Schedule = { interval_days: number; ease: number; reps: number; lapses: number; due_at: Date };

export const NEW_SCHEDULE = (now: Date): Schedule => ({ interval_days: 0, ease: 2.5, reps: 0, lapses: 0, due_at: now });

/** Map an attempt to SM-2 quality 0–5. */
export function qualityFrom(correct: boolean, hintsUsed: number, timeMs: number): number {
  if (!correct) return hintsUsed > 0 ? 1 : 2;
  if (hintsUsed >= 2) return 3;
  if (hintsUsed === 1) return 3;
  return timeMs > 0 && timeMs < 20_000 ? 5 : 4;
}

const DAY = 86_400_000;

export function nextSchedule(prev: Schedule, quality: number, now: Date, examDate?: Date | null): Schedule {
  const q = Math.max(0, Math.min(5, quality));
  let { ease, reps, lapses, interval_days } = prev;
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  let due: Date;
  if (q < 3) {
    reps = 0;
    lapses += 1;
    interval_days = 0;
    due = new Date(now.getTime() + 10 * 60_000);
  } else {
    reps += 1;
    interval_days = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(Math.max(1, interval_days) * ease);
    due = new Date(now.getTime() + interval_days * DAY);
  }
  if (examDate) {
    const eve = new Date(examDate.getTime() - DAY);
    if (due > eve && eve > now) due = eve;
  }
  return { interval_days, ease: +ease.toFixed(3), reps, lapses, due_at: due };
}

/** Mastery 0–100: moves toward the attempt's score, discounted for hints. */
export function nextMastery(current: number, correct: boolean, hintsUsed: number): number {
  const target = correct ? Math.max(60, 100 - 15 * hintsUsed) : 0;
  const next = current + 0.4 * (target - current);
  return Math.max(0, Math.min(100, Math.round(next)));
}

/** Rough minutes for a review queue (~45s per item, min 1). */
export const reviewMinutes = (n: number) => (n === 0 ? 0 : Math.max(1, Math.round(n * 0.75)));
