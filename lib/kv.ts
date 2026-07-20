import { Redis } from "@upstash/redis";
import type { Band, Member, Session, SessionStatus, Slot } from "./types";

const TTL_SECONDS = 60 * 60 * 24;

// Direct Upstash client. We were on @vercel/kv, which exhibited
// phantom-write behavior in production: routes returned 200 with a
// successful save log line, but subsequent reads returned the pre-write
// state (or sometimes never reflected the write at all). Same Upstash
// instance underneath, just bypassing the @vercel/kv wrapper.
// Exported so other modules (rate limiting) can share the connection.
export const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Sessions are stored as Redis hashes with one field per player slot, so
// concurrent writes touch disjoint fields and structurally can't clobber
// each other (the bug class behind the UNELVS/5KKQA8 lost-player2 sessions).
// Slot and band claims use HSETNX, which makes them atomic — no
// read-modify-write anywhere.
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
  const k = key(code);
  await redis.hset(k, {
    code: session.code,
    createdAt: session.createdAt,
    status: session.status,
  });
  await redis.expire(k, TTL_SECONDS);
  return session;
}

export async function getSession(code: string): Promise<Session | null> {
  const k = key(code);
  try {
    return await readHash(k);
  } catch {
    // Pre-hash sessions were single JSON strings; HGETALL on one throws
    // WRONGTYPE. Migrate in place (sessions expire within 24h, so this
    // path disappears a day after deploy).
    try {
      return await migrateLegacySession(k);
    } catch {
      // Concurrent migration got there first — it's a hash now.
      try {
        return await readHash(k);
      } catch {
        return null;
      }
    }
  }
}

async function readHash(k: string): Promise<Session | null> {
  const data = await redis.hgetall<Record<string, unknown>>(k);
  if (!data || Object.keys(data).length === 0) return null;
  return {
    code: String(data.code),
    createdAt: Number(data.createdAt),
    player1: (data.player1 as Member | undefined) ?? null,
    player2: (data.player2 as Member | undefined) ?? null,
    band: (data.band as Band | undefined) ?? null,
    status: (data.status as SessionStatus | undefined) ?? "waiting_p1",
  };
}

async function migrateLegacySession(k: string): Promise<Session | null> {
  const legacy = await redis.get<Session>(k);
  if (!legacy) return null;
  const ttl = await redis.ttl(k);
  const fields: Record<string, unknown> = {
    code: legacy.code,
    createdAt: legacy.createdAt,
    status: legacy.status,
  };
  if (legacy.player1) fields.player1 = legacy.player1;
  if (legacy.player2) fields.player2 = legacy.player2;
  if (legacy.band) fields.band = legacy.band;
  await redis.del(k);
  await redis.hset(k, fields);
  await redis.expire(k, ttl > 0 ? ttl : TTL_SECONDS);
  return legacy;
}

// Atomically claims a member slot. If the slot was already filled by a
// concurrent request, returns the existing member instead.
export async function claimSlot(
  code: string,
  slot: Slot,
  member: Member,
): Promise<{ claimed: boolean; member: Member; status: SessionStatus }> {
  const k = key(code);
  const set = await redis.hsetnx(k, slot, member);
  if (set === 0) {
    const existing = await redis.hget<Member>(k, slot);
    const session = await getSession(code);
    return {
      claimed: false,
      member: existing ?? member,
      status: session?.status ?? "waiting_p2",
    };
  }
  const status = await refreshStatus(code);
  await redis.expire(k, TTL_SECONDS);
  return { claimed: true, member, status };
}

// Atomically writes the band if none exists yet. Returns whether this call
// won the write.
export async function saveBand(code: string, band: Band): Promise<boolean> {
  const k = key(code);
  const set = await redis.hsetnx(k, "band", band);
  if (set === 1) {
    await refreshStatus(code);
    await redis.expire(k, TTL_SECONDS);
  }
  return set === 1;
}

// Overwrites the band field. Only for post-completion enrichment (e.g.
// attaching the generated single's audio URL) — never for initial creation.
export async function overwriteBand(code: string, band: Band): Promise<void> {
  await redis.hset(key(code), { band });
}

async function refreshStatus(code: string): Promise<SessionStatus> {
  const session = await getSession(code);
  const status = session ? nextStatus(session) : "waiting_p1";
  await redis.hset(key(code), { status });
  return status;
}

// In-flight lock for band generation. Prevents the background trigger from
// member.generate and BandView's ~6s fallback loop from running 2-4 concurrent
// generateBand calls for the same room (duplicate Claude + Flux spend — the
// worst thing to do while Replicate is throttling us). EX 120 (matching the
// route maxDuration) is a safety net in case the holding instance dies
// mid-generation.
async function acquireLock(kind: string, code: string): Promise<boolean> {
  const res = await redis.set(`bm:lock:${kind}:${code.toUpperCase()}`, "1", {
    nx: true,
    ex: 120,
  });
  return res === "OK";
}

function releaseLock(kind: string, code: string): Promise<unknown> {
  return redis.del(`bm:lock:${kind}:${code.toUpperCase()}`);
}

export const acquireBandLock = (code: string) => acquireLock("band", code);
export const releaseBandLock = async (code: string) => {
  await releaseLock("band", code);
};
export const acquireSingleLock = (code: string) => acquireLock("single", code);
export const releaseSingleLock = async (code: string) => {
  await releaseLock("single", code);
};

export function nextStatus(session: Session): SessionStatus {
  if (session.band) return "complete";
  if (session.player1 && session.player2) return "fusing";
  if (session.player1 || session.player2) return "waiting_p2";
  return "waiting_p1";
}
