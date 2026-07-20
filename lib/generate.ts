import {
  CLAUDE_BAND_MODEL,
  CLAUDE_MEMBER_MODEL,
  getAnthropic,
  toolInput,
} from "./anthropic";
import { uploadBytes, uploadImageFromUrl } from "./blob";
import { applyRisoPrint } from "./print";
import { generateSquareImage } from "./replicate";
import {
  BAND_SCHEMA,
  BAND_SYSTEM_PROMPT,
  MEMBER_SCHEMA,
  MEMBER_SYSTEM_PROMPT,
  albumCoverPrompt,
  portraitPrompt,
} from "./prompts";
import { classifyError } from "./errors";
import type { Band, Member, MemberStats } from "./types";

const IMAGE_RETRY_DELAY_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One retry, but only for transient failures, and with a pause first — an
// instant retry after a 429/throttle almost always hits the same wall and
// burns the only retry we have.
async function generateImageWithBackoff(prompt: string): Promise<string> {
  try {
    return await generateSquareImage(prompt);
  } catch (err) {
    const code = classifyError(err).code;
    if (code !== "model_busy" && code !== "generation_failed") throw err;
    await sleep(IMAGE_RETRY_DELAY_MS);
    return generateSquareImage(prompt);
  }
}

type MemberAi = {
  name: string;
  instrument: string;
  genreLean: string;
  bio: string;
  stats: MemberStats;
  visualDescriptor: string;
};

type BandAi = {
  name: string;
  genre: string;
  singleTitle: string;
  runtime: string;
  review: string;
  score: number;
  pullQuote: string;
  coverMotif?: string;
};

function clampStat(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 5;
  return Math.max(1, Math.min(10, Math.round(v)));
}

export async function generateMember(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  code: string,
  slot: "player1" | "player2",
): Promise<Member> {
  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: CLAUDE_MEMBER_MODEL,
    max_tokens: 700,
    system: MEMBER_SYSTEM_PROMPT,
    tools: [
      {
        name: "record_member",
        description: "Record the generated band member",
        input_schema: MEMBER_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "record_member" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: "Translate this object into a fictional band member.",
          },
        ],
      },
    ],
  });

  const ai = toolInput<MemberAi>(message, "record_member");

  const stats: MemberStats = {
    stagePresence: clampStat(ai.stats?.stagePresence),
    songwriting: clampStat(ai.stats?.songwriting),
    chaos: clampStat(ai.stats?.chaos),
    vibe: clampStat(ai.stats?.vibe),
  };

  const prompt = portraitPrompt(ai.visualDescriptor, ai.instrument, ai.genreLean);
  const portraitTmpUrl = await generateImageWithBackoff(prompt);
  const portraitUrl = await uploadImageFromUrl(
    portraitTmpUrl,
    `bandmate/${code}/${slot}-portrait.png`,
  );

  return {
    name: String(ai.name).trim(),
    instrument: String(ai.instrument).trim(),
    genreLean: String(ai.genreLean).trim(),
    bio: String(ai.bio).trim(),
    stats,
    portraitUrl,
    visualDescriptor: String(ai.visualDescriptor).trim(),
  };
}

export async function generateBand(
  member1: Member,
  member2: Member,
  code: string,
): Promise<Band> {
  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: CLAUDE_BAND_MODEL,
    max_tokens: 900,
    system: BAND_SYSTEM_PROMPT,
    tools: [
      {
        name: "record_band",
        description: "Record the band the two members form",
        input_schema: BAND_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "record_band" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Member 1:\n${JSON.stringify(memberForPrompt(member1), null, 2)}\n\nMember 2:\n${JSON.stringify(memberForPrompt(member2), null, 2)}\n\nGenerate the band they form.`,
          },
        ],
      },
    ],
  });

  const ai = toolInput<BandAi>(message, "record_band");

  let score = Number(ai.score);
  if (!Number.isFinite(score)) score = 7.3;
  // Defensive bounds only — model decides where the band actually lands.
  score = Math.max(1.0, Math.min(10.0, Math.round(score * 10) / 10));

  // Fall back to a generic motif if the model omits one (rare with the
  // schema requirement, but cheap to defend against).
  const coverMotif =
    typeof ai.coverMotif === "string" && ai.coverMotif.trim().length > 0
      ? ai.coverMotif.trim()
      : "an empty folding chair in a still room";

  const coverPrompt = albumCoverPrompt(ai.genre, coverMotif);
  const coverTmpUrl = await generateImageWithBackoff(coverPrompt);
  const albumCoverUrl = await uploadCoverWithRisoPrint(
    coverTmpUrl,
    ai.genre,
    code,
  );

  return {
    name: String(ai.name).trim(),
    genre: String(ai.genre).trim(),
    singleTitle: String(ai.singleTitle).trim(),
    runtime: String(ai.runtime).trim(),
    review: String(ai.review).trim(),
    score,
    pullQuote: String(ai.pullQuote).trim(),
    albumCoverUrl,
    coverMotif,
  };
}

// Fetch the raw Flux cover, run the deterministic riso finish, upload the
// result. If post-processing fails for any reason, upload the raw cover
// instead — a less-styled cover beats a failed band.
async function uploadCoverWithRisoPrint(
  tmpUrl: string,
  genre: string,
  code: string,
): Promise<string> {
  const pathname = `bandmate/${code}/album-cover.png`;
  try {
    const res = await fetch(tmpUrl);
    if (!res.ok) throw new Error(`cover fetch failed: ${res.status}`);
    const raw = Buffer.from(await res.arrayBuffer());
    const printed = await applyRisoPrint(raw, genre);
    return await uploadBytes(printed, pathname, "image/png");
  } catch (err) {
    console.error(
      `[band.generate] ${code} riso post-process failed, uploading raw cover:`,
      err,
    );
    return uploadImageFromUrl(tmpUrl, pathname);
  }
}

function memberForPrompt(m: Member) {
  return {
    name: m.name,
    instrument: m.instrument,
    genreLean: m.genreLean,
    bio: m.bio,
    stats: m.stats,
    visualDescriptor: m.visualDescriptor,
  };
}
