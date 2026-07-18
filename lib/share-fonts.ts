import { readFile } from "node:fs/promises";
import path from "node:path";

// @vercel/og (satori) only renders fonts whose data is passed explicitly —
// fontFamily strings alone silently fall back to the bundled default. These
// are the static TTFs backing the share card's type system. Paths are literal
// so Vercel's file tracing picks them up (plus outputFileTracingIncludes in
// next.config.mjs as a backstop).

export type ShareFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600;
  style: "normal" | "italic";
};

let cached: Promise<ShareFont[]> | null = null;

function ttf(file: string): Promise<ArrayBuffer> {
  return readFile(path.join(process.cwd(), "assets/fonts", file)).then(
    (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
}

export function getShareFonts(): Promise<ShareFont[]> {
  if (!cached) {
    cached = Promise.all([
      ttf("Newsreader-400.ttf").then((data) => ({
        name: "Newsreader",
        data,
        weight: 400 as const,
        style: "normal" as const,
      })),
      ttf("Newsreader-600.ttf").then((data) => ({
        name: "Newsreader",
        data,
        weight: 600 as const,
        style: "normal" as const,
      })),
      ttf("Newsreader-Italic-400.ttf").then((data) => ({
        name: "Newsreader",
        data,
        weight: 400 as const,
        style: "italic" as const,
      })),
      ttf("SpaceGrotesk-500.ttf").then((data) => ({
        name: "Space Grotesk",
        data,
        weight: 500 as const,
        style: "normal" as const,
      })),
      ttf("JetBrainsMono-400.ttf").then((data) => ({
        name: "JetBrains Mono",
        data,
        weight: 400 as const,
        style: "normal" as const,
      })),
    ]);
    // If loading fails (e.g. mispackaged deploy), don't poison the cache.
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
