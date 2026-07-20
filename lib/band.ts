import {
  getSession,
  saveBand,
  acquireBandLock,
  releaseBandLock,
} from "./kv";
import { generateBand } from "./generate";
import { classifyError } from "./errors";

// Generates the band for a session if both members are present and no band
// exists yet. Idempotent: safe to call concurrently from multiple paths
// (member.generate background trigger, band.generate route, retries) — a
// Redis NX lock ensures only one generation is actually in flight at a time.
// Returns true if this call wrote the band, false if it was a no-op.
export async function ensureBandGenerated(code: string): Promise<boolean> {
  const session = await getSession(code);
  if (!session) return false;
  if (!session.player1 || !session.player2) return false;
  if (session.band) return false;

  if (!(await acquireBandLock(code))) {
    // Another caller is mid-generation; polling will pick up its result.
    console.log(`[band.generate] ${code} lock held, skipping`);
    return false;
  }

  try {
    // Re-check under the lock: the previous holder may have saved between
    // our first read and lock acquisition.
    const current = await getSession(code);
    if (!current || current.band) return false;

    const band = await generateBand(session.player1, session.player2, code);

    const wrote = await saveBand(code, band);
    if (wrote) {
      console.log(`[band.generate] ${code} saved. name=${band.name}`);
    }
    return wrote;
  } catch (err) {
    const e = classifyError(err);
    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error(`[band.generate] ${code} ${e.code}: ${rawMessage}`);
    throw err;
  } finally {
    await releaseBandLock(code);
  }
}
