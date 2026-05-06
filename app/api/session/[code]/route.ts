import { NextResponse } from "next/server";
import { getSession } from "@/lib/kv";
import { isRoomCode } from "@/lib/code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { code: string } },
) {
  const code = params.code?.toUpperCase();
  if (!code || !isRoomCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }
  const session = await getSession(code);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(session, {
    headers: { "Cache-Control": "no-store" },
  });
}
