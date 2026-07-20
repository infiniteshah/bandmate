import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./kv";

// The generation endpoints are unauthenticated and each call costs real
// money (Opus vision + Flux, or MusicGen). Per-IP sliding windows, sized
// well above anything two humans playing the game would hit — this exists
// to stop scripts from draining API credit, not to throttle players.
const limiters = {
  create: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    prefix: "bm:rl:create",
  }),
  member: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(12, "10 m"),
    prefix: "bm:rl:member",
  }),
  single: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(6, "10 m"),
    prefix: "bm:rl:single",
  }),
};

export type LimiterName = keyof typeof limiters;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Returns true if the request is within limits. Fails open — a Redis
// hiccup shouldn't take the product down to protect pennies.
export async function withinRateLimit(
  req: Request,
  name: LimiterName,
): Promise<boolean> {
  try {
    const { success } = await limiters[name].limit(clientIp(req));
    return success;
  } catch (err) {
    console.error(`[ratelimit] ${name} check failed:`, err);
    return true;
  }
}
