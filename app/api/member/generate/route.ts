import { NextResponse } from "next/server";
import { claimSlot, getSession } from "@/lib/kv";
import { isRoomCode } from "@/lib/code";
import { generateMember } from "@/lib/generate";
import { ensureBandGenerated } from "@/lib/band";
import { classifyError, statusForCode } from "@/lib/errors";
import { withinRateLimit } from "@/lib/ratelimit";
import type { Slot } from "@/lib/types";

// ~6MB decoded. PhotoCapture compresses client-side to a fraction of this;
// anything bigger is not coming from our UI.
const MAX_IMAGE_BASE64_CHARS = 8_000_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  if (image.length > MAX_IMAGE_BASE64_CHARS) {
    return NextResponse.json(
      { error: "Photo is too large. Try again — we'll resize it for you." },
      { status: 413 },
    );
  }
  if (!(await withinRateLimit(req, "member"))) {
    return NextResponse.json(
      { error: "Too many generations from this connection. Try again in a few minutes." },
      { status: 429 },
    );
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
    // HSETNX slot claim — atomic, so a concurrent request for the same slot
    // loses cleanly and a write can never clobber the other player's slot.
    const result = await claimSlot(code, slot, member);
    if (!result.claimed) {
      return NextResponse.json(
        { error: "Slot already filled", member: result.member },
        { status: 409 },
      );
    }
    console.log(
      `[member.generate] ${code}/${slot} saved. status=${result.status}`,
    );

    // If this write filled both slots, kick off band generation immediately
    // instead of waiting for a client polling tick to discover it. We don't
    // await — band gen takes 15-25s and we want member.generate to return now
    // so the client can navigate to /band/[code] and show the fusion state.
    // The /api/band/generate route remains a fallback if this background
    // task dies (Fluid Compute usually keeps the instance warm long enough).
    if (result.status === "fusing") {
      ensureBandGenerated(code).catch((err) => {
        console.error(`[member.generate] ${code} background band gen failed:`, err);
      });
    }

    return NextResponse.json({ member, status: result.status });
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
