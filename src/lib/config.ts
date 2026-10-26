/** Runtime mode switches. Everything degrades gracefully to a zero-config demo. */
export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  geminiEmbedModel: process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001",
  dataDir: process.env.REVE_DATA_DIR || ".data",
};

/** Demo mode = no Supabase. Uses embedded Postgres (PGlite) and a single local user. */
export const isDemo = () => !(config.supabaseUrl && config.supabaseAnonKey && config.databaseUrl);
/** Mock AI = no Gemini key. Uses the rule-based demo tutor and lexical embeddings. */
export const isMockAI = () => !config.geminiKey;

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const EMBED_DIM = 768;
