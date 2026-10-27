import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.hoisted(() => { process.env.DATABASE_URL = "file:./test.db"; }); // never touch dev.db

const create = vi.fn();
vi.mock("./anthropic", () => ({ getAnthropic: () => ({ messages: { create } }) }));

import { db } from "@/lib/db";
import { handleMessage } from "./conversation";
import { DEFAULT_PERSONA } from "./philosophy";

let a: string, b: string;

beforeAll(async () => {
  a = (await db.client.create({ data: { name: "conv-a", persona: DEFAULT_PERSONA } })).id;
  b = (await db.client.create({ data: { name: "conv-b", persona: DEFAULT_PERSONA } })).id;
});
afterAll(async () => {
  await db.client.deleteMany({ where: { id: { in: [a, b] } } });
});

describe("handleMessage", () => {
  it("runs save_preference tool then stores the reply with a preference_saved action", async () => {
    create
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "tu_1", name: "save_preference", input: { exerciseName: "Burpees", kind: "disliked" } }],
      })
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "Noted, no more burpees." }] });

    const { messages } = await handleMessage(a, "he hates burpees");

    expect(create).toHaveBeenCalledTimes(2);
    // second call carries the tool_result in a user message
    const second = create.mock.calls[1][0].messages.at(-1);
    expect(second.role).toBe("user");
    expect(second.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu_1" });
    expect(create.mock.calls[0][0].tool_choice).toEqual({ type: "auto" });

    const prefs = await db.exercisePreference.findMany({ where: { clientId: a } });
    expect(prefs).toHaveLength(1);
    expect(prefs[0]).toMatchObject({ exerciseName: "Burpees", kind: "disliked" });

    const rows = await db.coachMessage.findMany({ where: { clientId: a }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.role)).toEqual(["user", "assistant"]);
    expect(JSON.parse(rows[1].action!)).toMatchObject({ type: "preference_saved", preferenceId: prefs[0].id });
    expect(messages).toHaveLength(2);

    expect(await db.exercisePreference.count({ where: { clientId: b } })).toBe(0);
    expect(await db.coachMessage.count({ where: { clientId: b } })).toBe(0);
  });

  it("returns tool errors to the model instead of throwing", async () => {
    create.mockReset();
    create
      .mockResolvedValueOnce({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_2", name: "review_session", input: { sessionId: "nope" } }] })
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "I could not find that session." }] });
    const { messages } = await handleMessage(a, "review it");
    expect(create.mock.calls[1][0].messages.at(-1).content[0].is_error).toBe(true);
    expect(messages[1].action).toBeNull();
  });
});
