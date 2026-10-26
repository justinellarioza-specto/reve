import { redirect } from "next/navigation";
import { Mark } from "@/components/Mark";
import { config, isDemo } from "@/lib/config";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  if (isDemo()) redirect("/");
  return (
    <div className="pt-12 max-w-sm mx-auto space-y-8">
      <div className="space-y-3">
        <Mark size={48} />
        <h1 className="text-2xl font-semibold tracking-tight leading-tight">Study by answering, not rereading.</h1>
        <p className="text-ink-2">Upload your slides. Reve asks the questions, tracks what you&apos;ve mastered and tells you what to study next.</p>
      </div>
      <LoginForm url={config.supabaseUrl} anonKey={config.supabaseAnonKey} />
    </div>
  );
}
