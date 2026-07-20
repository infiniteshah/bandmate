import Replicate from "replicate";

let client: Replicate | null = null;

export function getReplicate(): Replicate {
  if (!client) {
    const auth = process.env.REPLICATE_API_TOKEN;
    if (!auth) throw new Error("REPLICATE_API_TOKEN is not set");
    client = new Replicate({ auth });
  }
  return client;
}

// Flux-Dev (not Schnell): Schnell is fast but ignores style anchors like
// "risograph" and defaults to its base ligne-claire / new-wave aesthetic.
// Dev follows prompts much better — needed for the print-look we want.
// guidance ~3.5 + 28 steps is the sweet spot for dev.
const FLUX_MODEL = "black-forest-labs/flux-dev" as const;

export async function generateSquareImage(prompt: string): Promise<string> {
  const replicate = getReplicate();
  const output = (await replicate.run(FLUX_MODEL, {
    input: {
      prompt,
      aspect_ratio: "1:1",
      output_format: "png",
      output_quality: 90,
      num_outputs: 1,
      num_inference_steps: 28,
      guidance: 3.5,
      // go_fast runs the fp8-quantized model, which measurably weakens the
      // style adherence we picked flux-dev for. Worth the extra few seconds.
      go_fast: false,
      megapixels: "1",
    },
  })) as unknown;

  const url = firstUrl(output);
  if (!url) throw new Error("Replicate returned no image URL");
  return url;
}

// MusicGen for the band's single. stereo-melody-large needs a melody input;
// stereo-large is the right variant for text-only prompting. ~30-60s warm.
// Unlike flux-dev, meta/musicgen is NOT an official Replicate model — running
// it by bare name 404s, so the version must be pinned.
const MUSICGEN_MODEL =
  "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb" as const;

export async function generateSingleAudio(prompt: string): Promise<string> {
  const replicate = getReplicate();
  const output = (await replicate.run(MUSICGEN_MODEL, {
    input: {
      prompt,
      model_version: "stereo-large",
      duration: 15,
      output_format: "mp3",
      normalization_strategy: "loudness",
    },
  })) as unknown;

  const url = firstUrl(output);
  if (!url) throw new Error("Replicate returned no audio URL");
  return url;
}

function firstUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) {
      const u = (first as { url: unknown }).url;
      if (typeof u === "string") return u;
      if (typeof u === "function") {
        try {
          const v = (u as () => unknown)();
          if (typeof v === "string") return v;
          if (v instanceof URL) return v.toString();
        } catch {}
      }
    }
  }
  if (output && typeof output === "object" && "url" in output) {
    const u = (output as { url: unknown }).url;
    if (typeof u === "string") return u;
  }
  return null;
}
