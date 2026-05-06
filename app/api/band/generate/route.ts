import { NextResponse } from "next/server";
import { getSession, saveSession, nextStatus } from "@/lib/kv";
import { isRoomCode } from "@/lib/code";
import { generateBand } from "@/lib/generate";

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

  session.status = "fusing";
  await saveSession(session);

  const band = await generateBand(session.player1, session.player2, code);

  const fresh = (await getSession(code)) ?? session;
  if (fresh.band) {
    return NextResponse.json({ band: fresh.band, status: fresh.status });
  }
  fresh.band = band;
  fresh.status = nextStatus(fresh);
  await saveSession(fresh);

  return NextResponse.json({ band, status: fresh.status });
}
