import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Opus for the member call: it has the photo to read, and getting the
// object's vibe right is the highest-leverage decision in the whole pipeline.
export const CLAUDE_MEMBER_MODEL = "claude-opus-4-7";
// Sonnet for the band call: text-only, ~3–5s faster, and Sonnet's voice
// holds the Pitchfork tone well.
export const CLAUDE_BAND_MODEL = "claude-sonnet-4-6";

// Both generation calls force a tool call (tool_choice: {type: "tool"}), so
// the API guarantees schema-shaped input — no text scraping, no parse
// failures, no code-fence stripping.
export function toolInput<T>(
  message: Anthropic.Message,
  toolName: string,
): T {
  const block = message.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock =>
      b.type === "tool_use" && b.name === toolName,
  );
  if (!block) throw new Error(`No ${toolName} tool call in response`);
  return block.input as T;
}
