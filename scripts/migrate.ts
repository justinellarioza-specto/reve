// Apply supabase/migrations to the database in DATABASE_URL (your Supabase project).
// Usage: DATABASE_URL=... npm run db:migrate
import postgres from "postgres";
import { runMigrations } from "../src/lib/migrate.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to your Supabase Postgres connection string first.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1 });
await runMigrations({
  query: async (text: string, params: unknown[] = []) => (await sql.unsafe(text, params as never[])) as never,
  exec: async (text: string) => {
    await sql.unsafe(text);
  },
});
console.log("Migrations applied.");
await sql.end();
