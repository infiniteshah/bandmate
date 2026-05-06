import { NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/kv";
import { newRoomCode } from "@/lib/code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  for (let i = 0; i < 5; i++) {
    const code = newRoomCode();
    const existing = await getSession(code);
    if (!existing) {
      const session = await createSession(code);
      return NextResponse.json({ code: session.code });
    }
  }
  return NextResponse.json({ error: "Could not allocate room code" }, { status: 500 });
}
