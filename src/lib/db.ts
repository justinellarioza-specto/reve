import "server-only";
import { config, isDemo } from "./config";
import { runMigrations, type Queryable } from "./migrate";

type Row = Record<string, unknown>;
export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

let dbPromise: Promise<Db> | null = null;

/** Exposed for tests: point the app at an in-memory/explicit PGlite instance. */
export function setDbForTests(db: Db | null) {
  dbPromise = db ? Promise.resolve(db) : null;
}

export function getDb(): Promise<Db> {
  if (!dbPromise) dbPromise = (isDemo() ? openPglite() : openPostgres()).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

export async function createPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { vector } = await import("@electric-sql/pglite-pgvector");
  const pg = await PGlite.create({ dataDir, extensions: { vector } });
  const db: Db & Queryable = {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pg.query(sql, params);
      return res.rows as T[];
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
  };
  await runMigrations(db);
  return db;
}

async function openPglite(): Promise<Db> {
  const g = globalThis as unknown as { __revePglite?: Promise<Db> };
  // Survive Next.js dev hot reloads: one embedded database per process.
  g.__revePglite ??= (async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(config.dataDir, "pg");
    fs.mkdirSync(dir, { recursive: true });
    return createPglite(dir);
  })();
  return g.__revePglite;
}

async function openPostgres(): Promise<Db> {
  const { default: postgres } = await import("postgres");
  // prepare:false keeps us compatible with Supabase's transaction pooler (port 6543).
  const sql = postgres(config.databaseUrl, { prepare: false, max: 5 });
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.unsafe(text, params as never[])) as unknown as T[];
    },
  };
}

/** Format a number[] as a pgvector literal. */
export const toVector = (v: number[]) => `[${v.map((x) => (Number.isFinite(x) ? +x.toFixed(6) : 0)).join(",")}]`;
