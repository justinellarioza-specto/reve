import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (demo database) and the file parsers run on the server only.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector", "unpdf", "mammoth"],
  // Prompts are read from /prompts at runtime; make sure they ship with the server build.
  outputFileTracingIncludes: { "/**": ["./prompts/**/*", "./supabase/migrations/**/*"] },
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
};

export default nextConfig;
