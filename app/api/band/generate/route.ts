import { NextResponse } from "next/server";
import { getSession, saveSession, nextStatus } from "@/lib/kv";
import { isRoomCode } from "@/lib/code";
import { generateBand } from "@/lib/generate";
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

  // No early status="fusing" save — that pattern wrote the whole stale
  // session blob and risked clobbering a concurrent member.generate write.
  // The real idempotency check is the band==null guard above plus the
  // fresh re-read just before saving the band below.
  try {
    const band = await generateBand(session.player1, session.player2, code);

    const fresh = (await getSession(code)) ?? session;
    if (fresh.band) {
      return NextResponse.json({ band: fresh.band, status: fresh.status });
    }
    fresh.band = band;
    fresh.status = nextStatus(fresh);
    await saveSession(fresh);
    console.log(
      `[band.generate] ${code} saved. name=${band.name} status=${fresh.status}`,
    );

    return NextResponse.json({ band, status: fresh.status });
  } catch (err) {
    const e = classifyError(err);
    const rawMessage = err instanceof Error ? err.message : String(err);
    const cause = (err as Error & { cause?: unknown })?.cause;
    const causeMessage = cause instanceof Error ? cause.message : undefined;
    console.error(
      `[band.generate] ${code} ${e.code}: ${rawMessage}` +
        (causeMessage ? ` (cause: ${causeMessage})` : ""),
      err,
    );
    // No status revert needed — we no longer write status="fusing" up front,
    // so nothing to revert. Status is derived correctly on next read.
    return NextResponse.json(
      { error: e.userMessage, code: e.code, cause: rawMessage },
      { status: statusForCode(e.code) },
    );
  }
}
