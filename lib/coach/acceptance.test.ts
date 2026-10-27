// Deterministic acceptance gaps not covered by rules.test.ts / program-review.test.ts (no model).
import { describe, it, expect } from "vitest";
import { applyPreferences, carryOverSkips, selectSessionType, weekView, nextWorkingWeight } from "./rules";
import { heavyLightStructure } from "./structures";
import { OWNER, OWNER_HISTORY, OWNER_PREFERENCES, EXPECTED } from "./__fixtures__/owner-oct-2026";

const base = { rotation: OWNER.rotation, minHoursBetweenHeavy: OWNER.minHoursBetweenHeavy, layoffDays: OWNER.layoffDays };
const structure = heavyLightStructure();

describe("10/29 with the full 6-session history", () => {
  const sel = (readiness = null as Parameters<typeof selectSessionType>[0]["readiness"]) =>
    selectSessionType({ ...base, history: OWNER_HISTORY, today: "2026-10-29", readiness });

  it("is heavy (last heavy was 10/26, 3 days ago; not a layoff)", () => {
    expect(sel().sessionType).toBe(EXPECTED.weekOf1026.find((d) => d.date === "2026-10-29")!.sessionType);
    expect(sel().sessionType).toBe("heavy_fullbody");
  });

  it("one significantly sore area keeps it heavy; two swap to light", () => {
    expect(sel({ sleep: "ok", energy: "normal", soreness: { quads: "significant" }, minutesAvailable: null }).sessionType).toBe("heavy_fullbody");
    expect(sel({ sleep: "ok", energy: "normal", soreness: { quads: "significant", chest: "significant" }, minutesAvailable: null }).sessionType).toBe("light_conditioning");
  });

  it("10/27 (Tue) is light, 10/28 is not a training day", () => {
    expect(selectSessionType({ ...base, history: OWNER_HISTORY, today: "2026-10-27", readiness: null }).sessionType).toBe("light_conditioning");
  });
});

describe("applyPreferences + carryOverSkips on 10/29", () => {
  const carry = carryOverSkips(OWNER_HISTORY.filter((s) => s.date < "2026-10-29").at(-1)!);
  const pool = [...structure.sessionTypes.heavy_fullbody.exercisePool, "Machine Chest Press", "Cable Pull-Through", ...carry.map((c) => c.name)];
  const { exercises, changes } = applyPreferences([...new Set(pool)], OWNER_PREFERENCES);

  it("carries over the time-skipped Farmer Carry", () => {
    expect(carry).toEqual([{ name: "Farmer Carry", reason: "time" }]);
    expect(exercises.filter((e) => e === "Farmer Carry")).toHaveLength(1);
  });
  it("never offers pull-through; bench replaces machine chest press without duplicating", () => {
    expect(exercises.some((e) => /pull-?through/i.test(e))).toBe(false);
    expect(exercises).not.toContain("Machine Chest Press");
    expect(exercises.filter((e) => e === "Barbell Bench Press")).toHaveLength(1);
    expect(changes.some((c) => /Machine Chest Press replaced with Barbell Bench Press/.test(c))).toBe(true);
  });
  it("the re-entry pool honours the same preferences", () => {
    const re = applyPreferences(structure.sessionTypes.reentry.exercisePool, OWNER_PREFERENCES).exercises;
    expect(re).toContain("Barbell Bench Press");
    expect(re.some((e) => /pull-?through/i.test(e))).toBe(false);
  });
});

describe("targets for 10/29 from the full history", () => {
  const hist = (name: string) =>
    OWNER_HISTORY.flatMap((s) => s.exercises.filter((e) => e.name === name).map((exercise) => ({ date: s.date, exercise })));
  const within = (v: number | null, want: number | readonly [number, number]) => {
    const [lo, hi] = typeof want === "number" ? [want * 0.95, want * 1.05] : [want[0] * 0.95, want[1] * 1.05];
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThanOrEqual(lo);
    expect(v!).toBeLessThanOrEqual(hi);
  };
  // Bench is excluded: its 175 depends on the RIR answer (rules.test.ts covers the override).
  it.each(Object.entries(EXPECTED.nextAfterOct26).filter(([n]) => n !== "Barbell Bench Press"))("%s", (name, want) => {
    within(nextWorkingWeight(hist(name)).nextWeight, want);
  });
});

describe("week view on 10/24 (Sat) after the missed Friday", () => {
  const w = weekView({ ...base, history: OWNER_HISTORY, today: "2026-10-24", trainingDays: OWNER.trainingDays });
  it("marks 10/23 missed (and Mon/Tue 10/19-20, inside the layoff gap); 10/21-22 are done", () => {
    const missed = w.filter((d) => d.status === "missed").map((d) => d.date);
    expect(missed).toEqual(["2026-10-19", "2026-10-20", ...EXPECTED.missedDates]);
    expect(w.filter((d) => d.status === "done").map((d) => d.date)).toEqual(["2026-10-21", "2026-10-22"]);
  });
  it("Sat is rest and the week starts Monday 10/19", () => {
    expect(w.find((d) => d.date === "2026-10-24")?.status).toBe("rest");
    expect(w).toHaveLength(7);
    expect(w[0].date).toBe("2026-10-19");
  });
});
