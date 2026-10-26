import { EMBED_DIM } from "./config";

/** A piece of a source document with a citable label ("Slide 4", "Page 2", "Section: X"). */
export type Section = { label: string; text: string };

export const clean = (s: string) =>
  s
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Split sections into ~maxChars chunks on paragraph/sentence boundaries, keeping the label. */
export function chunkSections(sections: Section[], maxChars = 900): Section[] {
  const out: Section[] = [];
  for (const s of sections) {
    const text = clean(s.text);
    if (!text) continue;
    if (text.length <= maxChars) {
      out.push({ label: s.label, text });
      continue;
    }
    const pieces = text.split(/\n\n+|(?<=[.!?])\s+(?=[A-Z0-9])/);
    let buf = "";
    for (const p of pieces) {
      if (buf && (buf + " " + p).length > maxChars) {
        out.push({ label: s.label, text: buf.trim() });
        buf = "";
      }
      buf += (buf ? " " : "") + p;
    }
    if (buf.trim()) out.push({ label: s.label, text: buf.trim() });
  }
  return out;
}

/** Split pasted notes into sections by markdown-ish headings, else by blank-line blocks. */
export function sectionsFromText(raw: string, fallbackLabel = "Notes"): Section[] {
  const text = clean(raw);
  const lines = text.split("\n");
  const sections: Section[] = [];
  let label = "";
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) sections.push({ label: label || `${fallbackLabel} ¶${sections.length + 1}`, text: label ? `${label.replace(/^Section: /, "")}\n${body}` : body });
    buf = [];
  };
  for (const line of lines) {
    const h = line.match(/^#{1,3}\s+(.+)$/)?.[1] ?? (looksLikeHeading(line) ? line.replace(/:\s*$/, "") : null);
    if (h) {
      flush();
      label = `Section: ${h.trim()}`;
    } else buf.push(line);
  }
  flush();
  if (sections.length <= 1 && text.length > 1500) {
    return text.split(/\n\n+/).filter(Boolean).map((t, i) => ({ label: `${fallbackLabel} ¶${i + 1}`, text: t }));
  }
  return sections;
}

/** Short Title Case line (or one ending in ":") with no sentence punctuation. */
function looksLikeHeading(line: string): boolean {
  const l = line.trim();
  if (!l || l.length > 60 || /[.!?,;]$/.test(l) || l.startsWith("-")) return false;
  const words = l.replace(/:$/, "").split(/\s+/);
  if (words.length > 8 || !/^[\p{Lu}\d]/u.test(l)) return false;
  if (l.endsWith(":")) return true;
  const caps = words.filter((w) => /^[\p{Lu}\d(]/u.test(w) || ["and", "or", "of", "the", "vs", "vs.", "in", "to", "for", "a"].includes(w)).length;
  return caps / words.length >= 0.75;
}

const STOP = new Set(
  "a an the and or but if then else of to in on at by for with from as is are was were be been being this that these those it its into than which who whom whose what when where why how not no yes can could should would may might must will shall do does did done has have had having you your we our they their them he she his her i me my also each per via such more most less least very just only any all some other another same both either neither over under between about after before during while within without".split(
    " ",
  ),
);

export const tokenize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

/** Deterministic lexical embedding (feature hashing of words + bigrams). Used when no AI key is set. */
export function lexicalEmbedding(text: string, dim = EMBED_DIM): number[] {
  const v = new Array(dim).fill(0);
  const toks = tokenize(text);
  const add = (term: string, w: number) => {
    let h = 2166136261;
    for (let i = 0; i < term.length; i++) h = Math.imul(h ^ term.charCodeAt(i), 16777619);
    const idx = (h >>> 0) % dim;
    v[idx] += (h & 1 ? 1 : -1) * w;
  };
  toks.forEach((t, i) => {
    add(t, 1);
    if (t.length > 4) add(t.slice(0, 5), 0.5); // crude stemming
    if (i > 0) add(toks[i - 1] + " " + t, 0.7);
  });
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export const cosine = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return d / (Math.sqrt(na * nb) || 1);
};

export const sentences = (s: string) =>
  clean(s)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((x) => x.length >= 25 && x.length <= 260 && /[a-z]/.test(x));

/** Pick the most "key-term-like" word in a sentence for a cloze blank. */
export function keyTerm(sentence: string, prefer: string[] = []): string | null {
  const lower = sentence.toLowerCase();
  for (const p of prefer) if (p.length > 2 && lower.includes(p.toLowerCase())) return sentence.substr(lower.indexOf(p.toLowerCase()), p.length);
  const words = sentence.match(/\b[\p{L}\p{N}][\p{L}\p{N}-]{2,}\b/gu) ?? [];
  const scored = words
    .filter((w) => !STOP.has(w.toLowerCase()))
    .map((w, i) => ({ w, s: (/[A-Z]{2,}|\d/.test(w) ? 3 : 0) + (/^[A-Z]/.test(w) && i > 0 ? 1.5 : 0) + Math.min(w.length, 12) / 4 }))
    .sort((a, b) => b.s - a.s);
  return scored[0]?.w ?? null;
}

export function cloze(sentence: string, term: string) {
  const i = sentence.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return null;
  return sentence.slice(0, i) + "_____" + sentence.slice(i + term.length);
}

export const normalizeAnswer = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Is a typed answer close enough? Exact after normalizing, or one small typo for longer words. */
export function answerMatches(given: string, expected: string[]): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  return expected.some((e) => {
    const x = normalizeAnswer(e);
    if (!x) return false;
    if (g === x) return true;
    if (x.length >= 6 && levenshtein(g, x) <= 1) return true;
    return false;
  });
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function shuffle<T>(arr: T[], seed = Math.random()): T[] {
  const a = [...arr];
  let s = Math.floor(seed * 2 ** 31) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
