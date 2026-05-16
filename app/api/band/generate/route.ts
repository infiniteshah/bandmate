import { NextResponse } from "next/server";
import { getSession } from "@/lib/kv";
import { isRoomCode } from "@/lib/code";
import { ensureBandGenerated } from "@/lib/band";
import { classifyError, statusForCode } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = { code?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = body.code?.toUpperCase();
  if (!code || !isRoomCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const session = await getSession(code);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (!session.player1 || !session.player2) {
    return NextResponse.json({ error: "Both members required" }, { status: 409 });
  }
  if (session.band) {
    return NextResponse.json({ band: session.band, status: session.status });
  }

  try {
    await ensureBandGenerated(code);
    const fresh = (await getSession(code)) ?? session;
    return NextResponse.json({ band: fresh.band, status: fresh.status });
  } catch (err) {
    const e = classifyError(err);
    const rawMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: e.userMessage, code: e.code, cause: rawMessage },
      { status: statusForCode(e.code) },
    );
  }
}
