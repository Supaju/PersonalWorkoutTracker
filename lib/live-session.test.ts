import { describe, it, expect } from "vitest";
import { fromSession, liveReducer, diffMutations, restAfter, type LiveState } from "./live-session";
import type { ApiSession, ApiExercise } from "@/components/session/types";

let n = 0;
const id = () => `u${++n}`;
const rx = (rows: [string, number | null, number | null][]) =>
  JSON.stringify(rows.map(([t, w, r]) => ({ setType: t, weight: w, reps: r, targetRir: t === "working" ? 2 : null, durationSec: null, distanceYd: null })));

const ex = (over: Partial<ApiExercise>): ApiExercise => ({
  id: "e1", sessionId: "s1", name: "Lat Pulldown", muscleGroups: "lats", block: "strength", pairGroup: null, unit: "total", restSec: 90,
  cue: null, prescription: rx([["ramp", 100, 10], ["working", 120, 12], ["working", 120, 12]]), orderIndex: 0, aiNotes: null,
  added: false, swappedFrom: null, skipped: false, skipReason: null, sets: [], cardio: [], ...over,
});
const session = (exercises: ApiExercise[]): ApiSession => ({
  id: "s1", date: "2026-10-26", sessionType: "heavy_fullbody", phase: "planned", name: "t", estimatedMinutes: 45, durationMin: null,
  startedAt: null, finishedAt: null, notes: null, coachNotes: null, plan: null, coachReview: null, reviewedAt: null, exercises,
});
const init = (exs: ApiExercise[]) => fromSession(session(exs), id);
const E = (s: LiveState, i = 0) => s.exercises[i];

describe("fromSession", () => {
  it("prefills unlogged prescription rows", () => {
    const s = init([ex({})]);
    expect(E(s).sets.map((x) => [x.setType, x.weightLbs, x.reps, x.done, x.targetRir])).toEqual([
      ["ramp", 100, 10, false, null], ["working", 120, 12, false, 2], ["working", 120, 12, false, 2]]);
  });
  it("logged sets come back confirmed; remaining prescription follows (abandoned don't consume a slot)", () => {
    const logged = [
      { id: "a", exerciseId: "e1", setNumber: 1, setType: "ramp", weightLbs: 100, reps: 10, rir: null, durationSec: null, distanceYd: null, notes: null },
      { id: "b", exerciseId: "e1", setNumber: 2, setType: "abandoned", weightLbs: 150, reps: null, rir: null, durationSec: null, distanceYd: null, notes: null },
    ] as ApiExercise["sets"];
    const s = init([ex({ sets: logged })]);
    expect(E(s).sets.map((x) => [x.setType, x.done])).toEqual([["ramp", true], ["abandoned", true], ["working", false], ["working", false]]);
  });
});

describe("reducer", () => {
  it("confirm marks done and starts rest from restSec; abandoned does not rest", () => {
    let s = init([ex({})]);
    const [r, w] = E(s).sets;
    s = liveReducer(s, { t: "confirm", ex: "e1", set: r.id, now: 1000 });
    expect(s.rest).toEqual({ endsAt: 91_000, total: 90 });
    s = liveReducer(s, { t: "clearRest" });
    s = liveReducer(s, { t: "abandon", ex: "e1", set: w.id, newId: "retry" });
    s = liveReducer(s, { t: "confirm", ex: "e1", set: w.id, now: 5000 });
    expect(s.rest).toBeNull();
  });
  it("pairs rest only after the last member", () => {
    const s = init([ex({ id: "a", pairGroup: "A", orderIndex: 0 }), ex({ id: "b", pairGroup: "A", orderIndex: 1, name: "Row" })]);
    expect(restAfter(s, E(s, 0))).toBeNull();
    expect(restAfter(s, E(s, 1))).toBe(90);
  });
  it("steppers: weight +/-5, reps +/-1, never negative; RIR toggles; type toggles", () => {
    let s = init([ex({})]);
    const w = E(s).sets[1].id;
    s = liveReducer(s, { t: "adjust", ex: "e1", set: w, field: "weightLbs", delta: 5 });
    s = liveReducer(s, { t: "adjust", ex: "e1", set: w, field: "reps", delta: -1 });
    expect([E(s).sets[1].weightLbs, E(s).sets[1].reps]).toEqual([125, 11]);
    s = liveReducer(s, { t: "adjust", ex: "e1", set: w, field: "reps", delta: -50 });
    expect(E(s).sets[1].reps).toBe(0);
    s = liveReducer(s, { t: "setRir", ex: "e1", set: w, value: 2 });
    expect(E(s).sets[1].rir).toBe(2);
    s = liveReducer(s, { t: "setRir", ex: "e1", set: w, value: 2 });
    expect(E(s).sets[1].rir).toBeNull();
    s = liveReducer(s, { t: "toggleType", ex: "e1", set: w });
    expect(E(s).sets[1].setType).toBe("ramp");
  });
  it("abandon logs a failed attempt and adds a fresh retry at the same weight", () => {
    let s = init([ex({})]);
    const w = E(s).sets[1];
    s = liveReducer(s, { t: "abandon", ex: "e1", set: w.id, newId: "r1" });
    expect(E(s).sets.map((x) => [x.setType, x.weightLbs, x.done])).toEqual([
      ["ramp", 100, false], ["abandoned", 120, true], ["working", 120, false], ["working", 120, false]]);
    expect(E(s).sets[1].reps).toBeNull();
  });
  it("add/remove set, skip with reason advances focus, swap keeps original name once", () => {
    let s = init([ex({}), ex({ id: "e2", name: "Row", orderIndex: 1 })]);
    s = liveReducer(s, { t: "addSet", ex: "e1", id: "x" });
    expect(E(s).sets).toHaveLength(4);
    s = liveReducer(s, { t: "removeSet", ex: "e1", set: "x" });
    expect(E(s).sets).toHaveLength(3);
    s = liveReducer(s, { t: "skip", ex: "e1", reason: "time" });
    expect([E(s).skipped, E(s).skipReason, s.current]).toEqual([true, "time", 1]);
    s = liveReducer(s, { t: "swap", ex: "e2", name: "Machine Row" });
    s = liveReducer(s, { t: "swap", ex: "e2", name: "Cable Row" });
    expect([E(s, 1).name, E(s, 1).swappedFrom]).toEqual(["Cable Row", "Row"]);
  });
  it("move reorders and keeps focus on the same exercise; addExercise appends and focuses", () => {
    let s = init([ex({}), ex({ id: "e2", name: "Row", orderIndex: 1 })]);
    s = liveReducer(s, { t: "move", ex: "e1", dir: 1 });
    expect(s.exercises.map((e) => e.id)).toEqual(["e2", "e1"]);
    expect(s.current).toBe(1);
    s = liveReducer(s, { t: "addExercise", exercise: { ...E(s), id: "tmp-1", name: "Curl", sets: [], added: true } });
    expect([s.exercises.length, s.current]).toEqual([3, 2]);
  });
});

describe("diffMutations", () => {
  const mid = () => "m";
  it("confirm -> PUT with own id and 1-based setNumber; edit re-PUTs; unconfirm DELETEs", () => {
    const s0 = init([ex({})]);
    const w = E(s0).sets[1];
    const s1 = liveReducer(s0, { t: "confirm", ex: "e1", set: w.id, now: 0 });
    const m1 = diffMutations(s0, s1, mid);
    expect(m1).toHaveLength(1);
    expect(m1[0]).toMatchObject({ method: "PUT", url: `/api/sessions/s1/sets/${w.id}`, key: `set:${w.id}`, body: { exerciseId: "e1", setNumber: 2, setType: "working", weightLbs: 120, reps: 12 } });
    const s2 = liveReducer(s1, { t: "setRir", ex: "e1", set: w.id, value: 1 });
    expect(diffMutations(s1, s2, mid)[0].body).toMatchObject({ rir: 1 });
    const s3 = liveReducer(s2, { t: "unconfirm", ex: "e1", set: w.id });
    expect(diffMutations(s2, s3, mid)[0]).toMatchObject({ method: "DELETE" });
    expect(diffMutations(s3, s3, mid)).toEqual([]);
  });
  it("unconfirmed edits are not persisted", () => {
    const s0 = init([ex({})]);
    const s1 = liveReducer(s0, { t: "adjust", ex: "e1", set: E(s0).sets[0].id, field: "weightLbs", delta: 5 });
    expect(diffMutations(s0, s1, mid)).toEqual([]);
  });
  it("abandoned attempt persists as setType abandoned and renumbers later confirmed sets", () => {
    let s = init([ex({})]);
    const [r, w1, w2] = E(s).sets;
    s = liveReducer(s, { t: "confirm", ex: "e1", set: r.id, now: 0 });
    const before = s;
    s = liveReducer(s, { t: "abandon", ex: "e1", set: w1.id, newId: "r1" });
    const ms = diffMutations(before, s, mid);
    expect(ms.map((m) => [m.method, (m.body as { setType: string }).setType, (m.body as { setNumber: number }).setNumber])).toEqual([["PUT", "abandoned", 2]]);
    void w2;
  });
  it("skip, swap, reorder -> PATCH exercise; new exercise -> POST bound to temp id then its sets", () => {
    const s0 = init([ex({}), ex({ id: "e2", name: "Row", orderIndex: 1 })]);
    const skip = liveReducer(s0, { t: "skip", ex: "e1", reason: "time" });
    expect(diffMutations(s0, skip, mid)[0]).toMatchObject({ method: "PATCH", url: "/api/sessions/s1/exercises/e1", body: { skipped: true, skipReason: "time" } });
    const swap = liveReducer(s0, { t: "swap", ex: "e1", name: "Row 2" });
    expect(diffMutations(s0, swap, mid)[0].body).toEqual({ name: "Row 2", swappedFrom: "Lat Pulldown" });
    const mv = liveReducer(s0, { t: "move", ex: "e1", dir: 1 });
    expect(diffMutations(s0, mv, mid).map((m) => m.body)).toEqual([{ orderIndex: 0 }, { orderIndex: 1 }]);
    const added = liveReducer(s0, { t: "addExercise", exercise: { ...E(s0), id: "tmp-9", name: "Curl", added: true, sets: [{ ...E(s0).sets[1], id: "ns", done: true }] } });
    const ms = diffMutations(s0, added, mid);
    expect(ms[0]).toMatchObject({ method: "POST", bindTempId: "tmp-9", body: { name: "Curl" } });
    expect(ms[1]).toMatchObject({ method: "PUT", url: "/api/sessions/s1/sets/ns", body: { exerciseId: "tmp-9" } });
  });
  it("cardio persists once confirmed", () => {
    const s0 = init([ex({ id: "c", name: "Bike", unit: "cardio", prescription: null })]);
    expect(E(s0).cardio).not.toBeNull();
    const s1 = liveReducer(liveReducer(s0, { t: "cardio", ex: "c", patch: { minutes: 12, perceivedEffort: 7 } }), { t: "confirmCardio", ex: "c" });
    const m = diffMutations(s0, s1, mid);
    expect(m[0]).toMatchObject({ method: "PUT", url: "/api/sessions/s1/exercises/c/cardio", body: { minutes: 12, perceivedEffort: 7 } });
  });
});
