import { describe, it, expect } from "vitest";
import {
  selectSessionType, emphasisShifts, nextWorkingWeight, estimateWeightForReps, weekView, applyPreferences,
  estimateDuration, carryOverSkips, detectLayoff, daysBetween, musclesTrainedRecently, roundLoad,
  type LoggedExercise, type ReadinessInput,
} from "./rules";
import { OWNER, OWNER_HISTORY, OWNER_PREFERENCES, OCT21, OCT26, EXPECTED, historyBefore } from "./__fixtures__/owner-oct-2026";
import type { SessionPlan } from "./schemas";

const sel = (today: string, readiness: ReadinessInput | null = null) =>
  selectSessionType({
    history: historyBefore(today), today, rotation: OWNER.rotation,
    minHoursBetweenHeavy: OWNER.minHoursBetweenHeavy, layoffDays: OWNER.layoffDays, readiness,
  });

const exHist = (name: string, before = "2026-10-27") =>
  OWNER_HISTORY.filter((s) => s.date < before).flatMap((s) =>
    s.exercises.filter((e) => e.name === name).map((exercise) => ({ date: s.date, exercise })));

const ready = (r: Partial<ReadinessInput>): ReadinessInput => ({ sleep: "ok", energy: "normal", soreness: {}, minutesAvailable: null, ...r });

describe("dates and layoff", () => {
  it("daysBetween", () => expect(daysBetween("2026-10-08", "2026-10-21")).toBe(13));
  it("layoff is strictly greater", () => {
    expect(detectLayoff(historyBefore("2026-10-21"), "2026-10-21", 10)).toEqual({ isLayoff: true, daysSince: 13 });
    expect(detectLayoff(historyBefore("2026-10-18"), "2026-10-18", 10).isLayoff).toBe(false); // exactly 10 days
    expect(detectLayoff([], "2026-10-18", 10)).toEqual({ isLayoff: true, daysSince: null });
  });
});

describe("selectSessionType", () => {
  it.each(Object.entries(EXPECTED.sessionTypeOn))("%s -> %s", (d, t) => expect(sel(d).sessionType).toBe(t));
  it("poor sleep on a heavy day -> light", () => {
    const r = sel("2026-10-26", ready({ sleep: "poor" }));
    expect(r.sessionType).toBe("light_conditioning");
    expect(r.reasons.join(" ")).toMatch(/sleep/i);
  });
  it("two significant areas on a heavy day -> light", () => {
    expect(sel("2026-10-26", ready({ soreness: { quads: "significant", chest: "significant" } })).sessionType).toBe("light_conditioning");
  });
  it("single significant quads stays heavy and shifts emphasis", () => {
    const r = ready({ soreness: { quads: "significant" } });
    expect(sel("2026-10-26", r).sessionType).toBe("heavy_fullbody");
    expect(emphasisShifts(r)).toHaveLength(1);
    expect(emphasisShifts(r)[0]).toMatch(/hamstrings\/glutes/);
    expect(emphasisShifts(null)).toEqual([]);
  });
  it("rotation phases advance from the last rotation member", () => {
    const rot = ["upper_a", "lower_a", "upper_b", "lower_b"] as const;
    const h = [{ date: "2026-10-20", sessionType: "lower_a", phase: "recorded" as const, exercises: [] }];
    const r = selectSessionType({ history: h, today: "2026-10-22", rotation: [...rot], minHoursBetweenHeavy: 48, layoffDays: 10, readiness: null });
    expect(r.sessionType).toBe("upper_b");
  });
});

describe("nextWorkingWeight on 10/26 history", () => {
  const cases: [string, number][] = [
    ["Barbell Bench Press", 175], ["Leg Press", 400], ["Seated Cable Row", 125], ["Dumbbell RDL", 55],
    ["Seated Hamstring Curl", 170],
  ];
  it.each(cases)("%s -> %i", (name, w) => expect(nextWorkingWeight(exHist(name)).nextWeight).toBe(w));
  it("lat pulldown 125 with abandoned_sets flag", () => {
    const d = nextWorkingWeight(exHist("Lat Pulldown"));
    expect(d.nextWeight).toBe(125);
    expect(d.flags).toContain("abandoned_sets");
  });
  it("farmer carry reinstates at 53", () => {
    const d = nextWorkingWeight(exHist("Farmer Carry"));
    expect(d).toMatchObject({ nextWeight: 53, decision: "reinstate" });
    expect(d.flags).toContain("skipped");
  });
  it("bench with rirOverride 0 -> 175", () => {
    const d = nextWorkingWeight(exHist("Barbell Bench Press"), { rirOverride: 0 });
    expect(d.nextWeight).toBe(175);
    expect(d.decision).toBe("reduce");
  });
  it("bench with rirOverride 2 -> increase", () => {
    expect(nextWorkingWeight(exHist("Barbell Bench Press"), { rirOverride: 2 }).decision).toBe("increase");
  });
  it("chest press from 10/21: jump_too_big, 140-150", () => {
    const d = nextWorkingWeight(exHist("Machine Chest Press", "2026-10-22"));
    expect(d.flags).toContain("jump_too_big");
    expect(d.nextWeight).toBeGreaterThanOrEqual(140);
    expect(d.nextWeight).toBeLessThanOrEqual(150);
  });
  it("no history -> find_your_number", () => {
    expect(nextWorkingWeight([])).toMatchObject({ decision: "find_your_number", nextWeight: null });
  });
  it("missed target without a big jump holds the last weight that hit", () => {
    const e: LoggedExercise = {
      name: "X", unit: "total", muscleGroups: [], targetReps: 10, skipped: false, skipReason: null,
      sets: [
        { setType: "working", weight: 100, reps: 10, rir: 2 },
        { setType: "working", weight: 110, reps: 8, rir: 2 },
      ],
    };
    expect(nextWorkingWeight([{ date: "2026-01-01", exercise: e }])).toMatchObject({ decision: "hold", nextWeight: 100 });
  });
  it("estimateWeightForReps and roundLoad", () => {
    expect(estimateWeightForReps(180, 6, 12)).toBe(145);
    expect(roundLoad(62.5)).toBe(65);
    expect(roundLoad(62.4)).toBe(60);
  });
});

describe("weekView", () => {
  const input = (today: string) => ({
    history: OWNER_HISTORY, today, trainingDays: OWNER.trainingDays, rotation: OWNER.rotation,
    minHoursBetweenHeavy: OWNER.minHoursBetweenHeavy, layoffDays: OWNER.layoffDays,
  });
  it("week of 10/26 matches EXPECTED", () => {
    const w = weekView(input("2026-10-26")).map(({ date, status, sessionType }) => ({ date, status, sessionType }));
    expect(w).toEqual(EXPECTED.weekOf1026);
  });
  it("10/23 is missed on 10/24; 10/21 and 10/22 done", () => {
    const w = weekView(input("2026-10-24"));
    expect(w.find((d) => d.date === "2026-10-23")?.status).toBe("missed");
    expect(w.find((d) => d.date === "2026-10-21")?.status).toBe("done");
    expect(w.find((d) => d.date === "2026-10-22")?.status).toBe("done");
  });
});

describe("plan shaping", () => {
  it("applyPreferences drops disliked and maps substitutes", () => {
    const r = applyPreferences(["Cable Pull-Through", "Machine Chest Press", "Leg Press"], OWNER_PREFERENCES);
    expect(r.exercises).toEqual(["Barbell Bench Press", "Leg Press"]);
    expect(r.changes).toHaveLength(2);
    expect(applyPreferences(["cable pull-through"], OWNER_PREFERENCES).exercises).toEqual([]);
  });
  it("carryOverSkips(OCT26)", () => {
    expect(carryOverSkips(OCT26)).toEqual([{ name: "Farmer Carry", reason: "time" }]);
    expect(carryOverSkips(null)).toEqual([]);
    expect(carryOverSkips(OCT21)).toEqual([]);
  });
  it("estimateDuration matches hand computation", () => {
    const set = (setType: "ramp" | "working") => ({ setType, weight: 100, reps: 10, targetRir: null, durationSec: null, distanceYd: null });
    const ex = (name: string, pairGroup: string | null, sets: ReturnType<typeof set>[], restSec: number | null) =>
      ({ name, muscleGroups: [], pairGroup, unit: "total" as const, restSec, cue: "", whyTarget: null, sets, cardio: null });
    const cardio = (minutes: number) => ({
      name: "Bike", muscleGroups: [], pairGroup: null, unit: "cardio" as const, restSec: null, cue: "", whyTarget: null, sets: [],
      cardio: { machine: "bike", minutes, intervals: null, settings: null, targetEffort: "talk" },
    });
    const plan: SessionPlan = {
      sessionType: "heavy_fullbody", name: "t", coachNotes: "", estimatedMinutes: 0,
      blocks: [
        { block: "warmup", estimatedMinutes: 0, exercises: [cardio(5)] },
        { block: "strength", estimatedMinutes: 0, exercises: [
          ex("Leg Press", "A", [set("ramp"), set("working"), set("working")], 120),
          ex("Cable Row", "A", [set("working"), set("working")], 90),
        ] },
        { block: "conditioning", estimatedMinutes: 0, exercises: [cardio(10)] },
        { block: "cooldown", estimatedMinutes: 0, exercises: [cardio(5)] },
      ],
    };
    // strength: Leg Press 60 + 3*45 = 195 (no rest, not last of pair); Row 60 + 2*45 + 2*90 = 330; 525s -> 9 min
    expect(estimateDuration(plan)).toEqual({ total: 29, byBlock: { warmup: 5, strength: 9, conditioning: 10, cooldown: 5 } });
  });
  it("musclesTrainedRecently within 48h", () => {
    const m = musclesTrainedRecently(OWNER_HISTORY, "2026-10-24", 48);
    expect(m).toContain("shoulders"); // 10/22
    expect(m).not.toContain("chest"); // 10/21 is 72h back
  });
});
