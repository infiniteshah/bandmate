import { NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/kv";
import { newRoomCode } from "@/lib/code";
import { withinRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await withinRateLimit(req, "create"))) {
    return NextResponse.json(
      { error: "Too many new rooms from this connection. Try again in a few minutes." },
      { status: 429 },
    );
  }
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
