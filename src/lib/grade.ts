import type { Question } from "./repo";
import { answerMatches } from "./text";

export function isCorrect(q: Pick<Question, "type" | "answer" | "accept">, given: string): boolean {
  const g = given.trim();
  if (q.type === "fill") return answerMatches(g, [q.answer, ...(q.accept ?? [])]);
  if (q.type === "tf") return g.toLowerCase() === q.answer.toLowerCase();
  return g === q.answer.trim();
}
