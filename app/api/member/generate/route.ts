import { NextResponse } from "next/server";
import { getSession, saveSession, nextStatus } from "@/lib/kv";
import { isRoomCode } from "@/lib/code";
import { generateMember } from "@/lib/generate";
import { ensureBandGenerated } from "@/lib/band";
import { classifyError, statusForCode } from "@/lib/errors";
import type { Slot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  code?: string;
  slot?: Slot;
  image?: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = body.code?.toUpperCase();
  const slot = body.slot;
  const image = body.image;
  const mediaType = body.mediaType ?? "image/jpeg";

  if (!code || !isRoomCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }
  if (slot !== "player1" && slot !== "player2") {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }
  if (!image) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }

  const session = await getSession(code);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session[slot]) {
    return NextResponse.json({ error: "Slot already filled", member: session[slot] }, { status: 409 });
  }

  const base64 = stripDataUrl(image);

  try {
    const member = await generateMember(base64, mediaType, code, slot);
    // Re-read just before write so a stale session object can't clobber
    // the other slot (e.g. P2's save erasing P1, which is what happened
    // in the UNELVS/5KKQA8 sessions where player2 silently went missing).
    const fresh = (await getSession(code)) ?? session;
    if (fresh[slot]) {
      return NextResponse.json(
        { error: "Slot already filled", member: fresh[slot] },
        { status: 409 },
      );
    }
    fresh[slot] = member;
    fresh.status = nextStatus(fresh);
    await saveSession(fresh);
    console.log(
      `[member.generate] ${code}/${slot} saved. p1=${!!fresh.player1} p2=${!!fresh.player2} status=${fresh.status}`,
    );

    // If this write filled both slots, kick off band generation immediately
    // instead of waiting for a client polling tick to discover it. We don't
    // await — band gen takes 15-25s and we want member.generate to return now
    // so the client can navigate to /band/[code] and show the fusion state.
    // The /api/band/generate route remains a fallback if this background
    // task dies (Fluid Compute usually keeps the instance warm long enough).
    if (fresh.player1 && fresh.player2 && !fresh.band) {
      ensureBandGenerated(code).catch((err) => {
        console.error(`[member.generate] ${code} background band gen failed:`, err);
      });
    }

    return NextResponse.json({ member, status: fresh.status });
  } catch (err) {
    const e = classifyError(err);
    const rawMessage = err instanceof Error ? err.message : String(err);
    const cause = (err as Error & { cause?: unknown })?.cause;
    const causeMessage = cause instanceof Error ? cause.message : undefined;
    console.error(
      `[member.generate] ${code}/${slot} ${e.code}: ${rawMessage}` +
        (causeMessage ? ` (cause: ${causeMessage})` : ""),
      err,
    );
    return NextResponse.json(
      { error: e.userMessage, code: e.code, cause: rawMessage },
      { status: statusForCode(e.code) },
    );
  }
}

function stripDataUrl(s: string): string {
  const i = s.indexOf(",");
  if (s.startsWith("data:") && i > -1) return s.slice(i + 1);
  return s;
}
