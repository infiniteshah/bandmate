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

const FLUX_MODEL = "black-forest-labs/flux-schnell" as const;

export async function generateSquareImage(prompt: string): Promise<string> {
  const replicate = getReplicate();
  const output = (await replicate.run(FLUX_MODEL, {
    input: {
      prompt,
      aspect_ratio: "1:1",
      output_format: "png",
      output_quality: 90,
      num_outputs: 1,
      go_fast: true,
      megapixels: "1",
    },
  })) as unknown;

  const url = firstUrl(output);
  if (!url) throw new Error("Replicate returned no image URL");
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
