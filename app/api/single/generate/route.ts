import { NextResponse } from "next/server";
import { isRoomCode } from "@/lib/code";
import { classifyError, statusForCode } from "@/lib/errors";
import { getSession } from "@/lib/kv";
import { withinRateLimit } from "@/lib/ratelimit";
import { ensureSingleGenerated } from "@/lib/single";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// MusicGen can take 30-60s warm and longer on a cold boot.
export const maxDuration = 180;

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
  if (!session.band) {
    return NextResponse.json({ error: "Band not ready" }, { status: 409 });
  }
  if (session.band.singleAudioUrl) {
    return NextResponse.json({ singleAudioUrl: session.band.singleAudioUrl });
  }

  if (!(await withinRateLimit(req, "single"))) {
    return NextResponse.json(
      { error: "Too many singles from this connection. Try again in a few minutes." },
      { status: 429 },
    );
  }

  try {
    const singleAudioUrl = await ensureSingleGenerated(code);
    if (!singleAudioUrl) {
      // Lock held by a concurrent request — tell the client to re-ask soon.
      return NextResponse.json(
        { error: "Already cutting the single. Try again in a moment." },
        { status: 409 },
      );
    }
    return NextResponse.json({ singleAudioUrl });
  } catch (err) {
    const e = classifyError(err);
    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error(`[single.generate] ${code} ${e.code}: ${rawMessage}`);
    return NextResponse.json(
      { error: "Couldn't cut the single. Try once more.", code: e.code },
      { status: statusForCode(e.code) },
    );
  }
}
