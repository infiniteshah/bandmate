import { NextResponse } from "next/server";
import { getSession, saveSession, nextStatus } from "@/lib/kv";
import { isRoomCode } from "@/lib/code";
import { generateMember } from "@/lib/generate";
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

  const member = await generateMember(base64, mediaType, code, slot);
  session[slot] = member;
  session.status = nextStatus(session);
  await saveSession(session);

  return NextResponse.json({ member, status: session.status });
}

function stripDataUrl(s: string): string {
  const i = s.indexOf(",");
  if (s.startsWith("data:") && i > -1) return s.slice(i + 1);
  return s;
}
