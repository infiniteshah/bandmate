export type GenErrorCode =
  | "image_too_large"
  | "unreadable_photo"
  | "content_blocked"
  | "model_busy"
  | "generation_failed";

export class GenerationError extends Error {
  code: GenErrorCode;
  userMessage: string;
  constructor(code: GenErrorCode, userMessage: string, cause?: unknown) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
    if (cause) (this as Error & { cause?: unknown }).cause = cause;
  }
}

export function classifyError(err: unknown): GenerationError {
  if (err instanceof GenerationError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (/payload too large|413|request entity too large/.test(lower)) {
    return new GenerationError(
      "image_too_large",
      "Photo is too large. Try again — we'll resize it for you.",
      err,
    );
  }
  if (/safety|policy|content|nsfw|moderation|blocked|refused/.test(lower)) {
    return new GenerationError(
      "content_blocked",
      "Couldn't generate from that photo. Try a different object — not a person.",
      err,
    );
  }
  if (/json|parse|unexpected token|no json/.test(lower)) {
    return new GenerationError(
      "unreadable_photo",
      "Couldn't read that photo. Try one with a clearer subject.",
      err,
    );
  }
  if (/timeout|timed out|aborted|deadline/.test(lower)) {
    return new GenerationError(
      "model_busy",
      "That took too long. Try once more.",
      err,
    );
  }
  if (/rate.?limit|429|quota|capacity/.test(lower)) {
    return new GenerationError(
      "model_busy",
      "The model is busy. Try once more in a few seconds.",
      err,
    );
  }
  return new GenerationError(
    "generation_failed",
    "Something glitched mid-generation. Try once more.",
    err,
  );
}

export function statusForCode(code: GenErrorCode): number {
  switch (code) {
    case "image_too_large":
      return 413;
    case "unreadable_photo":
    case "content_blocked":
      return 422;
    case "model_busy":
      return 503;
    case "generation_failed":
      return 502;
  }
}
