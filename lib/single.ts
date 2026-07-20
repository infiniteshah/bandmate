import { uploadImageFromUrl } from "./blob";
import {
  acquireSingleLock,
  getSession,
  overwriteBand,
  releaseSingleLock,
} from "./kv";
import { generateSingleAudio } from "./replicate";
import type { Band, Member } from "./types";

// MusicGen responds best to genre + instrumentation + production vibe.
// The single title isn't audible, but the genre mashup is the whole point.
function singlePrompt(band: Band, m1: Member | null, m2: Member | null): string {
  const instruments = [m1?.instrument, m2?.instrument]
    .filter(Boolean)
    .join(" and ");
  return [
    band.genre,
    "instrumental",
    instruments ? `featuring ${instruments}` : null,
    "warm analog recording, tape saturation, 1970s independent single",
  ]
    .filter(Boolean)
    .join(", ");
}

// Generates the 15s single for a session's band if it doesn't exist yet.
// Same shape as ensureBandGenerated: idempotent, lock-guarded, safe to call
// from concurrent requests. Returns the audio URL, or null if it couldn't
// run (no band yet, or another generation is in flight).
export async function ensureSingleGenerated(
  code: string,
): Promise<string | null> {
  const session = await getSession(code);
  if (!session?.band) return null;
  if (session.band.singleAudioUrl) return session.band.singleAudioUrl;

  if (!(await acquireSingleLock(code))) {
    console.log(`[single.generate] ${code} lock held, skipping`);
    return null;
  }

  try {
    const current = await getSession(code);
    if (!current?.band) return null;
    if (current.band.singleAudioUrl) return current.band.singleAudioUrl;

    const prompt = singlePrompt(current.band, current.player1, current.player2);
    const tmpUrl = await generateSingleAudio(prompt);
    const singleAudioUrl = await uploadImageFromUrl(
      tmpUrl,
      `bandmate/${code}/single.mp3`,
    );

    await overwriteBand(code, { ...current.band, singleAudioUrl });
    console.log(`[single.generate] ${code} saved. url=${singleAudioUrl}`);
    return singleAudioUrl;
  } finally {
    await releaseSingleLock(code);
  }
}
