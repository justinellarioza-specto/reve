import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DEMO_USER_ID, isDemo } from "./config";
import { ensureUser } from "./repo";
import { seedSampleSubject } from "./seed";

export type CurrentUser = { id: string; email: string | null; demo: boolean };

/** The signed-in student (or the local demo student). New users get the sample subject. */
export const currentUser = cache(async (): Promise<CurrentUser> => {
  const tz = await timeZone();
  if (isDemo()) {
    const { isNew } = await ensureUser(DEMO_USER_ID, "demo@reve.local");
    if (isNew) await seedSampleSubject(DEMO_USER_ID, tz);
    return { id: DEMO_USER_ID, email: null, demo: true };
  }
  const { supabaseServer } = await import("./supabase/server");
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login");
  const { isNew } = await ensureUser(data.user.id, data.user.email ?? null);
  if (isNew) await seedSampleSubject(data.user.id, tz);
  return { id: data.user.id, email: data.user.email ?? null, demo: false };
});

export const userId = async () => (await currentUser()).id;

/** Student's time zone, set by the browser in a cookie (falls back to Asia/Manila). */
export async function timeZone(): Promise<string> {
  const tz = (await cookies()).get("tz")?.value;
  if (tz) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return tz;
    } catch {}
  }
  return process.env.APP_TIMEZONE || "Asia/Manila";
}
