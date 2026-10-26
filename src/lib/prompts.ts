import "server-only";
import fs from "node:fs";
import path from "node:path";

const cache = new Map<string, string>();

/** Load a prompt from /prompts and fill {{placeholders}}. */
export function prompt(name: string, vars: Record<string, string | number> = {}): string {
  let tpl = cache.get(name);
  if (!tpl || process.env.NODE_ENV === "development") {
    tpl = fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "prompts", `${name}.md`), "utf8");
    cache.set(name, tpl);
  }
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : ""));
}
