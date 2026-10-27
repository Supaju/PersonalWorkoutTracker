// DB-backed (test.db). The model is mocked; everything numeric must come from the rules.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db";

vi.mock("./llm", () => ({ callStructured: vi.fn() }));
import { callStructured } from "./llm";
import { planSession, refinePlan, reviewSession, answerQuestion } from "./engine";
import { estimateDuration } from "./rules";
import { OWNER, OWNER_CONSIDERATIONS, OWNER_PREFERENCES, OWNER_HISTORY } from "./__fixtures__/owner-oct-2026";
import type { PlannedExercise, SessionPlan, SessionReview } from "./schemas";

const mocked = vi.mocked(callStructured);
const CLIENT = `engine-test-${Date.now()}`;
let oct26Id = "";

beforeAll(async () => {
  await db.client.create({
    data: {
      id: CLIENT, name: OWNER.name, persona: "Calm and direct.", trainingDays: JSON.stringify(OWNER.trainingDays),
      defaultMinutes: OWNER.defaultMinutes, layoffDays: OWNER.layoffDays,
      profile: { create: { age: OWNER.age, gender: OWNER.gender, heightIn: OWNER.heightIn, weightLbs: OWNER.weightLbs, goals: OWNER.goals } },
      considerations: { create: OWNER_CONSIDERATIONS },
      preferences: { create: OWNER_PREFERENCES.map((p) => ({ exerciseName: p.exerciseName, kind: p.kind, substituteFor: p.substituteFor })) },
    },
  });
  await db.programVersion.create({
    data: {
      clientId: CLIENT, version: 1, phase: "heavy_light_fullbody", reason: "test", startDate: "2026-10-01",
      structure: JSON.stringify({
        phase: "heavy_light_fullbody", description: "d", rotation: OWNER.rotation, progression: "p", conditioning: "c", minHoursBetweenHeavy: 48,
        sessionTypes: { heavy_fullbody: { label: "Heavy", focus: "f", exercisePool: ["Barbell Bench Press", "Leg Press", "Seated Cable Row", "Cable Pull-Through"] } },
      }),
    },
  });
  for (const s of OWNER_HISTORY) {
    const row = await db.workoutSession.create({
      data: { clientId: CLIENT, date: s.date, template: s.sessionType, sessionType: s.sessionType, phase: "recorded", name: s.date },
    });
    if (s.date === "2026-10-26") oct26Id = row.id;
    let i = 0;
    for (const e of s.exercises) {
      await db.sessionExercise.create({
        data: {
          sessionId: row.id, name: e.name, muscleGroups: e.muscleGroups.join(","), unit: e.unit, orderIndex: i++,
          targetReps: e.targetReps === null ? "" : String(e.targetReps), skipped: e.skipped, skipReason: e.skipReason,
          sets: { create: e.sets.map((x, n) => ({ setNumber: n + 1, setType: x.setType, weightLbs: x.weight, reps: x.reps, rir: x.rir, durationSec: x.durationSec ?? null, distanceYd: x.distanceYd ?? null })) },
        },
      });
    }
  }
});

afterAll(async () => {
  await db.client.delete({ where: { id: CLIENT } });
});

beforeEach(() => { mocked.mockReset(); });

const set = (setType: "ramp" | "working", weight: number | null, reps: number) =>
  ({ setType, weight, reps, targetRir: setType === "working" ? 2 : null, durationSec: null, distanceYd: null });
const lift = (name: string, pairGroup: string | null, sets: ReturnType<typeof set>[]): PlannedExercise => ({
  name, muscleGroups: ["chest"], pairGroup, unit: "total", restSec: 90, cue: "cue", whyTarget: "model reason", sets, cardio: null,
});
const bike = (minutes: number): PlannedExercise => ({
  name: "Recumbent Bike", muscleGroups: ["conditioning"], pairGroup: null, unit: "cardio", restSec: null, cue: "easy", whyTarget: null,
  sets: [], cardio: { machine: "recumbent_bike", minutes, intervals: null, settings: null, targetEffort: "talk test" },
});
const planOf = (strength: PlannedExercise[]): SessionPlan => ({
  sessionType: "heavy_fullbody", name: "Heavy full body", coachNotes: "notes", estimatedMinutes: 1,
  blocks: [
    { block: "warmup", estimatedMinutes: 1, exercises: [bike(5)] },
    { block: "strength", estimatedMinutes: 1, exercises: strength },
    { block: "conditioning", estimatedMinutes: 1, exercises: [bike(10)] },
    { block: "cooldown", estimatedMinutes: 1, exercises: [bike(5)] },
  ],
});
const goodStrength = () => [
  lift("Barbell Bench Press", null, [set("ramp", 135, 8), set("working", 999, 10), set("working", 999, 10)]),
  lift("Leg Press", "A", [set("ramp", 180, 10), set("working", 1, 10), set("working", 1, 10)]),
  lift("Seated Cable Row", "A", [set("ramp", 70, 10), set("working", 1, 12)]),
];

describe("planSession", () => {
  it("persists a planned session, overrides weights, recomputes minutes", async () => {
    mocked.mockResolvedValueOnce(planOf(goodStrength()));
    const { sessionId, plan } = await planSession(CLIENT, { date: "2026-10-29" });
    const row = await db.workoutSession.findUniqueOrThrow({ where: { id: sessionId }, include: { exercises: { orderBy: { orderIndex: "asc" } } } });
    expect(row).toMatchObject({ clientId: CLIENT, phase: "planned", sessionType: "heavy_fullbody", name: "Heavy full body", coachNotes: "notes" });
    expect(JSON.parse(row.plan!).sessionType).toBe("heavy_fullbody");

    const w = (name: string) => plan.blocks.flatMap((b) => b.exercises).find((e) => e.name === name)!.sets.filter((s) => s.setType === "working").map((s) => s.weight);
    expect(w("Barbell Bench Press")).toEqual([175, 175]); // model said 999
    expect(w("Leg Press")).toEqual([400, 400]);
    expect(w("Seated Cable Row")).toEqual([125]);

    expect(plan.estimatedMinutes).toBe(estimateDuration(plan).total);
    expect(plan.estimatedMinutes).not.toBe(1);
    expect(row.estimatedMinutes).toBe(plan.estimatedMinutes);
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(60);

    const bench = row.exercises.find((e) => e.name === "Barbell Bench Press")!;
    expect(bench).toMatchObject({ block: "strength", targetReps: "10", targetWeight: 175, aiNotes: "model reason", unit: "total" });
    expect(JSON.parse(bench.prescription!)).toHaveLength(3);
    expect(row.exercises.find((e) => e.name === "Leg Press")!.pairGroup).toBe("A");
    expect(row.exercises.map((e) => e.orderIndex)).toEqual(row.exercises.map((_, i) => i));
  });

  it("removes disliked exercises", async () => {
    mocked.mockResolvedValueOnce(planOf([...goodStrength(), lift("Cable Pull-Through", null, [set("working", 65, 12)])]));
    const { plan } = await planSession(CLIENT, { date: "2026-10-29" });
    const names = plan.blocks.flatMap((b) => b.exercises.map((e) => e.name));
    expect(names).not.toContain("Cable Pull-Through");
    expect(names).toContain("Leg Press");
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it("re-asks once when removing disliked exercises empties a block", async () => {
    mocked.mockResolvedValueOnce(planOf([lift("Cable Pull-Through", null, [set("working", 65, 12)])]));
    mocked.mockResolvedValueOnce(planOf(goodStrength()));
    const { plan } = await planSession(CLIENT, { date: "2026-10-29" });
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(mocked.mock.calls[1][0].user).toMatch(/Cable Pull-Through/);
    expect(plan.blocks.find((b) => b.block === "strength")!.exercises.length).toBe(3);
  });

  it("trims ramp sets on non-primary lifts when over the available minutes", async () => {
    const raw = planOf([...goodStrength(), lift("Seated Hamstring Curl", null, [set("ramp", 110, 10), set("ramp", 130, 10), set("working", 1, 12)])]);
    const total = estimateDuration(raw).total;
    const ci = await db.checkIn.create({ data: { clientId: CLIENT, kind: "pre", date: "2026-10-29", minutesAvailable: total - 1 } });
    mocked.mockResolvedValueOnce(raw);
    const { plan, sessionId } = await planSession(CLIENT, { date: "2026-10-29", checkInId: ci.id });
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(total - 1);
    const ex = (n: string) => plan.blocks.flatMap((b) => b.exercises).find((e) => e.name === n)!;
    expect(ex("Barbell Bench Press").sets.filter((s) => s.setType === "ramp")).toHaveLength(1);
    expect(ex("Leg Press").sets.filter((s) => s.setType === "ramp")).toHaveLength(1);
    expect(ex("Seated Hamstring Curl").sets.filter((s) => s.setType === "ramp").length).toBeLessThan(2);
    expect((await db.checkIn.findUniqueOrThrow({ where: { id: ci.id } })).sessionId).toBe(sessionId);
  });
});

describe("refinePlan", () => {
  it("saves a stated dislike, drops it, rewrites rows", async () => {
    mocked.mockResolvedValueOnce(planOf(goodStrength()));
    const { sessionId } = await planSession(CLIENT, { date: "2026-10-29" });
    mocked.mockResolvedValueOnce({
      plan: planOf([goodStrength()[0], goodStrength()[1], lift("Hip Thrust", null, [set("working", 100, 10)])]),
      reply: "Swapped.", savedPreferences: [{ exerciseName: "Seated Cable Row", kind: "disliked", substituteFor: null }],
    });
    const r = await refinePlan(CLIENT, sessionId, "I hate seated rows");
    expect(r.savedPreferenceIds).toHaveLength(1);
    expect(r.reply).toBe("Swapped.");
    const pref = await db.exercisePreference.findFirstOrThrow({ where: { clientId: CLIENT, exerciseName: "Seated Cable Row" } });
    expect(pref.kind).toBe("disliked");
    const rows = await db.sessionExercise.findMany({ where: { sessionId } });
    expect(rows.map((x) => x.name)).toContain("Hip Thrust");
    expect(rows.map((x) => x.name)).not.toContain("Seated Cable Row");
    await db.exercisePreference.delete({ where: { id: pref.id } });
  });
});

describe("reviewSession / answerQuestion", () => {
  const canned: SessionReview = { summary: "Solid.", highlights: ["h"], progressions: [], decisionsNeeded: [], clarifyingQuestions: [] };

  it("creates required clarifying questions and recomputes bench from the answer", async () => {
    mocked.mockResolvedValueOnce(canned);
    const review = await reviewSession(CLIENT, oct26Id);
    const qs = await db.clarifyingQuestion.findMany({ where: { sessionId: oct26Id } });
    const has = (kind: string, name: string) => qs.some((q) => q.kind === kind && q.exerciseName === name);
    expect(has("rir", "Barbell Bench Press")).toBe(true);
    expect(has("abandoned", "Lat Pulldown")).toBe(true);
    expect(has("skip", "Farmer Carry")).toBe(true);
    expect(review.clarifyingQuestions.length).toBe(qs.length);
    expect(JSON.parse(qs.find((q) => q.kind === "rir")!.options)).toEqual(["Had 2–3 left", "Had 1 left", "Nothing left"]);

    const prog = (n: string) => review.progressions.find((p) => p.exerciseName === n)?.nextWeight;
    expect(prog("Barbell Bench Press")).toBe(175);
    expect(prog("Leg Press")).toBe(400);
    expect(prog("Farmer Carry")).toBe(53);
    expect((await db.workoutSession.findUniqueOrThrow({ where: { id: oct26Id } })).reviewedAt).not.toBeNull();

    const bench = qs.find((q) => q.kind === "rir" && q.exerciseName === "Barbell Bench Press")!;
    const r = await answerQuestion(CLIENT, bench.id, "Nothing left");
    expect(r.progression).toMatchObject({ exerciseName: "Barbell Bench Press", nextWeight: 175 });
    const after = await db.clarifyingQuestion.findUniqueOrThrow({ where: { id: bench.id } });
    expect(after.answer).toBe("Nothing left");
    expect(after.answeredAt).not.toBeNull();

    const up = await answerQuestion(CLIENT, bench.id, "Had 2–3 left");
    expect(up.progression?.nextWeight).toBe(195); // 185 * 1.05 = 194.25 -> 195
  });

  it("does not answer another client's question", async () => {
    const q = await db.clarifyingQuestion.findFirstOrThrow({ where: { sessionId: oct26Id } });
    await expect(answerQuestion("someone-else", q.id, "x")).rejects.toThrow();
  });
});
