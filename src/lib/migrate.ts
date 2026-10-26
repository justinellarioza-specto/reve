import fs from "node:fs";
import path from "node:path";

export interface Queryable {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  exec?(sql: string): Promise<void>;
}

const MIGRATIONS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "supabase", "migrations");

/** Apply supabase/migrations/*.sql in order, once each. Used by demo mode and `npm run db:migrate`. */
export async function runMigrations(db: Queryable, dir = MIGRATIONS_DIR) {
  await db.query(`create table if not exists _reve_migrations (name text primary key, applied_at timestamptz default now())`);
  const done = new Set((await db.query<{ name: string }>(`select name from _reve_migrations`)).map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    if (db.exec) await db.exec(sql);
    else await db.query(sql);
    await db.query(`insert into _reve_migrations(name) values ($1)`, [f]);
  }
}
