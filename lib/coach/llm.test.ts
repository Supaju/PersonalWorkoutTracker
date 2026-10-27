import { describe, it, expect, afterEach, vi } from "vitest";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { callStructured, _setClientForTests } from "./llm";

const testSchema = z.object({ a: z.number() });

describe("callStructured", () => {
  afterEach(() => {
    _setClientForTests(null);
  });

  it("resolves with parsed_output when stop_reason is end_turn", async () => {
    const mockMessages = {
      parse: vi.fn().mockResolvedValue({
        stop_reason: "end_turn",
        parsed_output: { a: 1 },
      }),
    };

    _setClientForTests({ messages: mockMessages } as unknown as Pick<Anthropic, "messages">);

    const result = await callStructured({
      model: "test-model",
      system: "test system",
      user: "test user",
      schema: testSchema,
    });

    expect(result).toEqual({ a: 1 });
    expect(mockMessages.parse).toHaveBeenCalledTimes(1);
  });

  it("retries once and resolves when first call throws, second succeeds", async () => {
    const mockMessages = {
      parse: vi
        .fn()
        .mockRejectedValueOnce(new Error("validation error"))
        .mockResolvedValueOnce({
          stop_reason: "end_turn",
          parsed_output: { a: 1 },
        }),
    };

    _setClientForTests({ messages: mockMessages } as unknown as Pick<Anthropic, "messages">);

    const result = await callStructured({
      model: "test-model",
      system: "test system",
      user: "test user",
      schema: testSchema,
    });

    expect(result).toEqual({ a: 1 });
    expect(mockMessages.parse).toHaveBeenCalledTimes(2);
  });

  it("rejects when stop_reason is refusal", async () => {
    const mockMessages = {
      parse: vi.fn().mockResolvedValue({
        stop_reason: "refusal",
        parsed_output: null,
      }),
    };

    _setClientForTests({ messages: mockMessages } as unknown as Pick<Anthropic, "messages">);

    await expect(
      callStructured({
        model: "test-model",
        system: "test system",
        user: "test user",
        schema: testSchema,
      })
    ).rejects.toThrow("Model refused the request");
  });

  it("rejects when stop_reason is max_tokens", async () => {
    const mockMessages = {
      parse: vi.fn().mockResolvedValue({
        stop_reason: "max_tokens",
        parsed_output: null,
      }),
    };

    _setClientForTests({ messages: mockMessages } as unknown as Pick<Anthropic, "messages">);

    await expect(
      callStructured({
        model: "test-model",
        system: "test system",
        user: "test user",
        schema: testSchema,
      })
    ).rejects.toThrow("Model output was truncated (max_tokens)");
  });
});
