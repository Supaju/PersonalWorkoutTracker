// Lazily-created Anthropic client for conversation + routes. Tests mock this module.
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  return (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
}
