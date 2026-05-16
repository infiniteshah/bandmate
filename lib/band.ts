import { getSession, saveSession, nextStatus } from "./kv";
import { generateBand } from "./generate";
import { classifyError } from "./errors";

// Generates the band for a session if both members are present and no band
// exists yet. Idempotent: safe to call concurrently from multiple paths
// (member.generate background trigger, band.generate route, retries).
// Returns true if this call wrote the band, false if it was a no-op.
export async function ensureBandGenerated(code: string): Promise<boolean> {
  const session = await getSession(code);
  if (!session) return false;
  if (!session.player1 || !session.player2) return false;
  if (session.band) return false;

  try {
    const band = await generateBand(session.player1, session.player2, code);

    const fresh = (await getSession(code)) ?? session;
    if (fresh.band) return false;
    fresh.band = band;
    fresh.status = nextStatus(fresh);
    await saveSession(fresh);
    console.log(
      `[band.generate] ${code} saved. name=${band.name} status=${fresh.status}`,
    );
    return true;
  } catch (err) {
    const e = classifyError(err);
    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error(`[band.generate] ${code} ${e.code}: ${rawMessage}`);
    throw err;
  }
}
