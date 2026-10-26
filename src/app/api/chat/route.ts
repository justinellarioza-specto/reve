import { NextResponse } from "next/server";
import { z } from "zod";
import { userId } from "@/lib/auth";
import { tutorTurn } from "@/lib/services";

const Body = z.object({ sessionId: z.string().uuid(), text: z.string().trim().min(1).max(4000) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type a message first." }, { status: 400 });
  try {
    const uid = await userId();
    const message = await tutorTurn(uid, parsed.data.sessionId, parsed.data.text);
    return NextResponse.json({ message });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Reve couldn't reply." }, { status: 500 });
  }
}
