import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.hoisted(() => { process.env.DATABASE_URL = "file:./test.db"; }); // never touch dev.db

let current = "";
vi.mock("@/lib/client", () => ({ getClientId: async () => current, CLIENT_COOKIE: "clientId" }));

import { db } from "@/lib/db";
import { DEFAULT_PERSONA } from "@/lib/coach/philosophy";
import * as nutrition from "./nutrition/route";
import * as entries from "./nutrition/entries/route";
import * as entryById from "./nutrition/entries/[id]/route";
import * as equipment from "./equipment/route";
import * as profile from "./profile/route";
import * as messages from "./coach/messages/route";

const json = (body: unknown, method = "POST") =>
  new Request("http://x/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const p = <T extends object>(o: T) => ({ params: Promise.resolve(o) });
const DATE = "2026-10-26";
const nutritionGet = () => nutrition.GET(new Request(`http://x/api/nutrition?date=${DATE}`));
const messagesGet = () => messages.GET(new Request("http://x/api/coach/messages"));

let c1: string, c2: string, entryId: string, equipId: string;

beforeAll(async () => {
  c1 = (await db.client.create({ data: { name: "nut-iso-1", persona: DEFAULT_PERSONA } })).id;
  c2 = (await db.client.create({ data: { name: "nut-iso-2", persona: DEFAULT_PERSONA } })).id;
  current = c1;
  entryId = (await (await entries.POST(json({ date: DATE, slot: "lunch", description: "c1 chicken", calories: 500, protein: 50 }))).json()).id;
  equipId = (await (await equipment.POST(json({ name: "c1 barbell", category: "free_weights" }))).json()).id;
  await profile.POST(json({ name: "One", age: 30, gender: "male", heightFt: 6, heightIn: 2, weightLbs: 370, goals: "lose_weight" }));
  await db.mealPlan.create({ data: { clientId: c1, date: DATE, meals: "c1 plan" } });
  await db.nutritionChat.create({ data: { clientId: c1, date: DATE, role: "user", content: "c1 chat" } });
  await db.coachMessage.create({ data: { clientId: c1, role: "user", content: "c1 secret" } });
});
afterAll(async () => {
  await db.client.deleteMany({ where: { id: { in: [c1, c2] } } });
});

describe("nutrition and profile isolation", () => {
  it("client 1 sees its own data", async () => {
    current = c1;
    const n = await (await nutritionGet()).json();
    expect(n.entries).toHaveLength(1);
    expect(n.chat).toHaveLength(1);
    expect(await (await equipment.GET()).json()).toHaveLength(1);
    expect((await (await profile.GET()).json()).name).toBe("One");
    expect(await (await messagesGet()).json()).toHaveLength(1);
  });

  it("client 2 sees nothing of client 1", async () => {
    current = c2;
    const n = await (await nutritionGet()).json();
    expect(n.entries).toEqual([]);
    expect(n.chat).toEqual([]);
    expect(await (await equipment.GET()).json()).toEqual([]);
    expect(await (await profile.GET()).json()).toBeNull();
    expect(await (await messagesGet()).json()).toEqual([]);
    expect(await db.mealPlan.findUnique({ where: { clientId_date: { clientId: c2, date: DATE } } })).toBeNull();
  });

  it("client 2 cannot edit or delete client 1's rows", async () => {
    current = c2;
    expect((await entryById.PUT(json({ description: "hacked" }, "PUT"), p({ id: entryId }))).status).toBe(404);
    expect((await entryById.DELETE(new Request("http://x", { method: "DELETE" }), p({ id: entryId }))).status).toBe(404);
    expect((await equipment.DELETE(new Request(`http://x/api/equipment?id=${equipId}`, { method: "DELETE" }))).status).toBe(404);
    expect((await db.nutritionEntry.findUniqueOrThrow({ where: { id: entryId } })).description).toBe("c1 chicken");
    expect(await db.equipment.count({ where: { id: equipId } })).toBe(1);
  });

  it("client 2's own writes stay with client 2; profile upsert does not touch client 1", async () => {
    current = c2;
    await entries.POST(json({ date: DATE, slot: "dinner", description: "c2 fish", calories: 400 }));
    await profile.POST(json({ name: "Two", age: 25, gender: "female", heightFt: 5, heightIn: 6, weightLbs: 150, goals: "general" }));
    current = c1;
    const n = await (await nutritionGet()).json();
    expect(n.entries.map((e: { description: string }) => e.description)).toEqual(["c1 chicken"]);
    expect((await (await profile.GET()).json()).name).toBe("One");
  });
});
