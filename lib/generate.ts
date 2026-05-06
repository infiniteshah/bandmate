import { CLAUDE_MODEL, extractText, getAnthropic, parseJsonResponse } from "./anthropic";
import { uploadImageFromUrl } from "./blob";
import { generateSquareImage } from "./replicate";
import {
  BAND_SYSTEM_PROMPT,
  MEMBER_SYSTEM_PROMPT,
  albumCoverPrompt,
  portraitPrompt,
} from "./prompts";
import type { Band, Member, MemberStats } from "./types";

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
    model: CLAUDE_MODEL,
    max_tokens: 700,
    system: MEMBER_SYSTEM_PROMPT,
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
            text: "Translate this object into a fictional band member. Return only JSON.",
          },
        ],
      },
    ],
  });

  const ai = parseJsonResponse<MemberAi>(extractText(message.content));

  const stats: MemberStats = {
    stagePresence: clampStat(ai.stats?.stagePresence),
    songwriting: clampStat(ai.stats?.songwriting),
    chaos: clampStat(ai.stats?.chaos),
    vibe: clampStat(ai.stats?.vibe),
  };

  const portraitTmpUrl = await generateSquareImage(
    portraitPrompt(ai.visualDescriptor, ai.instrument),
  );
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
    model: CLAUDE_MODEL,
    max_tokens: 900,
    system: BAND_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Member 1:\n${JSON.stringify(memberForPrompt(member1), null, 2)}\n\nMember 2:\n${JSON.stringify(memberForPrompt(member2), null, 2)}\n\nReturn only JSON for the band they form.`,
          },
        ],
      },
    ],
  });

  const ai = parseJsonResponse<BandAi>(extractText(message.content));

  let score = Number(ai.score);
  if (!Number.isFinite(score)) score = 7.3;
  score = Math.max(6.0, Math.min(8.9, Math.round(score * 10) / 10));

  const coverTmpUrl = await generateSquareImage(
    albumCoverPrompt(ai.genre, member1.visualDescriptor, member2.visualDescriptor),
  );
  const albumCoverUrl = await uploadImageFromUrl(
    coverTmpUrl,
    `bandmate/${code}/album-cover.png`,
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
  };
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
