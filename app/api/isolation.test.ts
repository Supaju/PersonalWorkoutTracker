import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.hoisted(() => { process.env.DATABASE_URL = "file:./test.db"; }); // never touch dev.db

let current = "";
vi.mock("@/lib/client", () => ({ getClientId: async () => current, CLIENT_COOKIE: "clientId" }));

import { db } from "@/lib/db";
import { DEFAULT_PERSONA } from "@/lib/coach/philosophy";
import * as sessions from "./sessions/route";
import * as sessionById from "./sessions/[id]/route";
import * as setRoute from "./sessions/[id]/sets/[setId]/route";
import * as prefs from "./preferences/route";
import * as checkins from "./checkins/route";

const json = (body: unknown, method = "POST") =>
  new Request("http://x/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const p = <T extends object>(o: T) => ({ params: Promise.resolve(o) });

let c1: string, c2: string, sessionId: string, exId: string;

beforeAll(async () => {
  c1 = (await db.client.create({ data: { name: "iso-1", persona: DEFAULT_PERSONA } })).id;
  c2 = (await db.client.create({ data: { name: "iso-2", persona: DEFAULT_PERSONA } })).id;
  current = c1;
  const s = await (await sessions.POST(json({
    date: "2026-10-20", exercises: [{ name: "Leg press", sets: [{ weightLbs: 200, reps: 10 }] }],
  }))).json();
  sessionId = s.id;
  exId = s.exercises[0].id;
  await prefs.POST(json({ exerciseName: "Burpees", kind: "disliked" }));
  await checkins.POST(json({ kind: "pre", date: "2026-10-26", sleep: "good" }));
});
afterAll(async () => {
  await db.client.deleteMany({ where: { id: { in: [c1, c2] } } });
});

describe("client isolation", () => {
  it("client 1 sees its own data", async () => {
    current = c1;
    expect((await (await sessions.GET()).json())).toHaveLength(1);
    expect((await sessionById.GET(new Request("http://x"), p({ id: sessionId }))).status).toBe(200);
    expect((await (await prefs.GET()).json())).toHaveLength(1);
  });

  it("client 2 gets 404 / nothing", async () => {
    current = c2;
    expect((await (await sessions.GET()).json())).toHaveLength(0);
    expect((await sessionById.GET(new Request("http://x"), p({ id: sessionId }))).status).toBe(404);
    expect((await sessionById.PATCH(json({ notes: "x" }, "PATCH"), p({ id: sessionId }))).status).toBe(404);
    expect((await sessionById.DELETE(new Request("http://x", { method: "DELETE" }), p({ id: sessionId }))).status).toBe(404);
    expect((await (await prefs.GET()).json())).toHaveLength(0);
    // writing a set into client 1's session
    const put = await setRoute.PUT(json({ exerciseId: exId, setNumber: 2, reps: 5 }, "PUT"), p({ id: sessionId, setId: "set-evil" }));
    expect(put.status).toBe(404);
    expect(await db.setLog.count({ where: { id: "set-evil" } })).toBe(0);
    // check-in pointing at client 1's session
    expect((await checkins.POST(json({ kind: "next_day", date: "2026-10-21", sessionId }))).status).toBe(404);
    // deleting client 1's preference
    const pref = await db.exercisePreference.findFirstOrThrow({ where: { clientId: c1 } });
    expect((await prefs.DELETE(new Request(`http://x/api/preferences?id=${pref.id}`, { method: "DELETE" }))).status).toBe(404);
    expect(await db.exercisePreference.count({ where: { clientId: c1 } })).toBe(1);
  });

  it("set PUT is idempotent and activates a planned session", async () => {
    current = c1;
    await db.workoutSession.update({ where: { id: sessionId }, data: { phase: "planned" } });
    const body = { exerciseId: exId, setNumber: 2, reps: 8, weightLbs: 210 };
    for (let i = 0; i < 2; i++) {
      expect((await setRoute.PUT(json(body, "PUT"), p({ id: sessionId, setId: "set-ok" }))).status).toBe(200);
    }
    expect(await db.setLog.count({ where: { id: "set-ok" } })).toBe(1);
    const s = await db.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(s.phase).toBe("active");
    expect(s.startedAt).not.toBeNull();
    // 400 on bad input
    expect((await setRoute.PUT(json({ nope: 1 }, "PUT"), p({ id: sessionId, setId: "set-bad" }))).status).toBe(400);
  });

  it("PATCH recorded sets finishedAt/durationMin; edit after review flags needsReReview", async () => {
    current = c1;
    await db.workoutSession.update({ where: { id: sessionId }, data: { startedAt: new Date(Date.now() - 45 * 60000), reviewedAt: new Date() } });
    const r = await (await sessionById.PATCH(json({ phase: "recorded" }, "PATCH"), p({ id: sessionId }))).json();
    expect(r.finishedAt).toBeTruthy();
    expect(r.durationMin).toBeGreaterThanOrEqual(44);
    const put = await (await setRoute.PUT(json({ exerciseId: exId, setNumber: 3, reps: 5 }, "PUT"), p({ id: sessionId, setId: "set-late" }))).json();
    expect(put.needsReReview).toBe(true);
  });
});
