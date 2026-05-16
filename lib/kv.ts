import { Redis } from "@upstash/redis";
import type { Session, SessionStatus } from "./types";

const TTL_SECONDS = 60 * 60 * 24;

// Direct Upstash client. We were on @vercel/kv, which exhibited
// phantom-write behavior in production: routes returned 200 with a
// successful save log line, but subsequent reads returned the pre-write
// state (or sometimes never reflected the write at all). Same Upstash
// instance underneath, just bypassing the @vercel/kv wrapper.
const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN!,
});

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
  await redis.set(key(code), session, { ex: TTL_SECONDS });
  return session;
}

export async function getSession(code: string): Promise<Session | null> {
  const data = await redis.get<Session>(key(code));
  return data ?? null;
}

export async function saveSession(session: Session): Promise<void> {
  await redis.set(key(session.code), session, { ex: TTL_SECONDS });
}

export function nextStatus(session: Session): SessionStatus {
  if (session.band) return "complete";
  if (session.player1 && session.player2) return "fusing";
  if (session.player1 || session.player2) return "waiting_p2";
  return "waiting_p1";
}
