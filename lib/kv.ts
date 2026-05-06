import { kv } from "@vercel/kv";
import type { Session, SessionStatus } from "./types";

const TTL_SECONDS = 60 * 60 * 24;

function key(code: string) {
  return `bm:session:${code.toUpperCase()}`;
}

export async function createSession(code: string): Promise<Session> {
  const session: Session = {
    code: code.toUpperCase(),
    createdAt: Date.now(),
    player1: null,
    player2: null,
    band: null,
    status: "waiting_p1",
  };
  await kv.set(key(code), session, { ex: TTL_SECONDS });
  return session;
}

export async function getSession(code: string): Promise<Session | null> {
  const data = (await kv.get<Session>(key(code))) ?? null;
  return data;
}

export async function saveSession(session: Session): Promise<void> {
  await kv.set(key(session.code), session, { ex: TTL_SECONDS });
}

export function nextStatus(session: Session): SessionStatus {
  if (session.band) return "complete";
  if (session.player1 && session.player2) return "fusing";
  if (session.player1 || session.player2) return "waiting_p2";
  return "waiting_p1";
}
