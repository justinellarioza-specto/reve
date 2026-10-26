import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { config } from "../config";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}
