import sharp from "sharp";

// Deterministic risograph finish for album covers. Flux gets us composition;
// this pass guarantees the print process: a two-ink duotone on cream paper,
// with the accent ink laid down slightly off-register (like a real second
// riso pass) and paper grain on top. Runs on the raw Flux output before the
// cover is uploaded to Blob, so every cover lands in the same visual world
// as the app chrome regardless of what the model felt like doing.

type Rgb = [number, number, number];

type InkPalette = {
  keywords: string[];
  ink: Rgb; // shadows / linework
  accent: Rgb; // second pass, midtones, printed off-register
};

// Matches the app's paper color (#efe9dd).
const PAPER: Rgb = [239, 233, 221];

const FALLBACK_PALETTE: InkPalette = {
  keywords: [],
  ink: [26, 24, 20], // app ink #1a1814
  accent: [200, 85, 61], // app accent #c8553d
};

// Ink pairs loosely modeled on real riso ink stocks (federal blue, bright
// red, hunter green, marigold, teal, burnt orange). Keyword hit-count on the
// band's genre string picks the pair, so palette varies by genre family but
// stays inside one print tradition.
const PALETTES: InkPalette[] = [
  {
    keywords: ["punk", "noise", "hardcore", "industrial", "garage", "sludge", "doom", "no wave", "math rock", "post-hardcore"],
    ink: [34, 31, 27],
    accent: [217, 68, 48],
  },
  {
    keywords: ["ambient", "dream", "shoegaze", "drone", "slowcore", "fourth-world", "minimal"],
    ink: [47, 68, 112],
    accent: [224, 135, 154],
  },
  {
    keywords: ["folk", "country", "americana", "twee", "songwriter", "lo-fi", "gothic", "alt-country"],
    ink: [70, 49, 31],
    accent: [201, 111, 47],
  },
  {
    keywords: ["techno", "idm", "electro", "synth", "hyperpop", "ebm", "witch house", "cold wave", "dance"],
    ink: [74, 61, 120],
    accent: [15, 155, 142],
  },
  {
    keywords: ["dub", "jazz", "tropic", "cumbia", "ethio", "world", "afro", "reggae"],
    ink: [46, 92, 64],
    accent: [227, 165, 28],
  },
  {
    keywords: ["glam", "baroque", "chamber", "art rock", "theatrical", "art pop"],
    ink: [77, 39, 64],
    accent: [195, 154, 44],
  },
];

export function pickPalette(genre: string): InkPalette {
  const g = genre.toLowerCase();
  let best = FALLBACK_PALETTE;
  let bestHits = 0;
  for (const p of PALETTES) {
    const hits = p.keywords.filter((k) => g.includes(k)).length;
    if (hits > bestHits) {
      best = p;
      bestHits = hits;
    }
  }
  return best;
}

const SIZE = 1024;
// Accent pass registration offset, in pixels at 1024 — visible but not sloppy.
const OFFSET_X = 5;
const OFFSET_Y = 3;
// Accent ink coverage: strongest in midtones, fading out in shadows and
// highlights (gaussian on luminance).
const ACCENT_PEAK = 0.45;
const ACCENT_SIGMA = 0.17;
const ACCENT_STRENGTH = 0.72;

export async function applyRisoPrint(
  image: Buffer,
  genre: string,
): Promise<Buffer> {
  const { ink, accent } = pickPalette(genre);

  const { data: lum } = await sharp(image)
    .resize(SIZE, SIZE, { fit: "cover" })
    .greyscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(SIZE * SIZE * 3);
  const denom = 2 * ACCENT_SIGMA * ACCENT_SIGMA;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      // Slight contrast lift keeps the duotone from going muddy.
      let t = lum[i] / 255;
      t = Math.min(1, Math.max(0, (t - 0.5) * 1.35 + 0.5));

      // Base pass: ink → paper by luminance.
      let r = ink[0] + (PAPER[0] - ink[0]) * t;
      let g = ink[1] + (PAPER[1] - ink[1]) * t;
      let b = ink[2] + (PAPER[2] - ink[2]) * t;

      // Accent pass, sampled off-register: translucent ink multiplies over
      // the base, coverage peaking in the midtones.
      const sx = Math.min(SIZE - 1, Math.max(0, x - OFFSET_X));
      const sy = Math.min(SIZE - 1, Math.max(0, y - OFFSET_Y));
      const ts = lum[sy * SIZE + sx] / 255;
      const d = ts - ACCENT_PEAK;
      const a = ACCENT_STRENGTH * Math.exp(-(d * d) / denom);
      if (a > 0.01) {
        r = r * (1 - a) + ((r * accent[0]) / 255) * a;
        g = g * (1 - a) + ((g * accent[1]) / 255) * a;
        b = b * (1 - a) + ((b * accent[2]) / 255) * a;
      }

      const o = i * 3;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
    }
  }

  // Paper grain: mid-grey gaussian noise overlaid softly on the whole print.
  const grain = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
      noise: { type: "gaussian", mean: 128, sigma: 13 },
    },
  })
    .png()
    .toBuffer();

  return sharp(out, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .composite([{ input: grain, blend: "overlay" }])
    .png()
    .toBuffer();
}
