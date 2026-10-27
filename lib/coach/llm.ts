import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

export interface StructuredOpts<T> {
  model: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  maxTokens?: number;
}

// Module-level lazily initialized client
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return client;
}

export async function callStructured<T>(opts: StructuredOpts<T>): Promise<T> {
  const { model, system, user, schema, maxTokens } = opts;
  const c = getClient();

  // Retry once on any parse/validation failure; refusals and truncation are final.
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await c.messages.parse({
        model,
        max_tokens: maxTokens ?? 8000,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { format: zodOutputFormat(schema), effort: "medium" },
      });
      if (response.stop_reason === "refusal") throw new Final("Model refused the request");
      if (response.stop_reason === "max_tokens") throw new Final("Model output was truncated (max_tokens)");
      if (response.parsed_output == null) throw new Error("Parsed output is null or undefined");
      return response.parsed_output;
    } catch (error) {
      if (error instanceof Final || attempt > 0) throw error;
    }
  }
}

class Final extends Error {}

// Test injection
export function _setClientForTests(c: Pick<Anthropic, "messages"> | null): void {
  if (c === null) {
    client = null;
  } else {
    // Create a mock client with the injected messages
    client = {
      messages: c.messages,
    } as Anthropic;
  }
}
