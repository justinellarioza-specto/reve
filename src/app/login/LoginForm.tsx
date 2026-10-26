"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export function LoginForm({ url, anonKey }: { url: string; anonKey: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const sb = createBrowserClient(url, anonKey);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    if (error) {
      setError(error.message);
      setState("error");
    } else setState("sent");
  }

  if (state === "sent")
    return (
      <p role="status" className="rounded-2xl bg-good-bg text-good px-4 py-3 font-semibold">
        Check {email} for a sign-in link. You can close this tab.
      </p>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">School or personal email</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field text-lg" />
      </div>
      {state === "error" && <p role="alert" className="text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</button>
    </form>
  );
}
