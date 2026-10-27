import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const parse = vi.fn();
vi.mock("@/lib/coach/anthropic", () => ({ getAnthropic: () => ({ messages: { parse } }) }));
import { callStructured } from "./llm";

const opts = { model: "m", system: "s", user: "u", schema: z.object({ a: z.number() }) };
beforeEach(() => { parse.mockReset(); });

describe("callStructured", () => {
  it("returns parsed_output", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { a: 1 } });
    expect(await callStructured(opts)).toEqual({ a: 1 });
    expect(parse.mock.calls[0][0].output_config.effort).toBe("medium");
  });
  it("retries once after a failure", async () => {
    parse.mockRejectedValueOnce(new Error("bad json")).mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { a: 2 } });
    expect(await callStructured(opts)).toEqual({ a: 2 });
    expect(parse).toHaveBeenCalledTimes(2);
  });
  it("gives up after the second failure", async () => {
    let n = 0;
    parse.mockImplementation(async () => { n++; throw new Error("bad json"); });
    const e = await callStructured(opts).then(() => null, (x: Error) => x);
    expect(e?.message).toBe("bad json");
    expect(n).toBe(2);
  });
  it.each([["refusal", /refused/], ["max_tokens", /truncated/]])("%s is final", async (reason, re) => {
    parse.mockResolvedValue({ stop_reason: reason, parsed_output: null });
    await expect(callStructured(opts)).rejects.toThrow(re);
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
