// Pure state for the live record screen: build it from the API session, reduce actions on it, and diff two states
// into the API mutations that persist the change. No React, no fetch: the page wires these to the offline queue.
import type { ApiSession, LoadUnit, PlannedCardio, SetType } from "@/components/session/types";
import { parsePrescription, plannedCardioFor } from "@/components/session/types";
import type { Mutation } from "./offline-queue";

export interface LiveSet {
  id: string; setType: SetType; weightLbs: number | null; reps: number | null; rir: number | null;
  durationSec: number | null; distanceYd: number | null; done: boolean; targetRir: number | null;
}
export interface CardioSettings { speed?: number; incline?: number; level?: number }
export interface LiveCardio {
  machine: string; minutes: number; settings: CardioSettings; intervals: string | null; perceivedEffort: number | null;
  talkTest: "full_sentences" | "short_phrases" | "few_words" | null; heartRate: number | null; distanceMi: number | null;
  calories: number | null; done: boolean; plan: PlannedCardio | null;
}
export interface LiveExercise {
  id: string; name: string; muscleGroups: string; block: string; pairGroup: string | null; unit: LoadUnit;
  restSec: number | null; cue: string | null; whyTarget: string | null; sets: LiveSet[]; skipped: boolean;
  skipReason: string | null; added: boolean; swappedFrom: string | null; cardio: LiveCardio | null; tags: string[];
}
export interface LiveState {
  sessionId: string; exercises: LiveExercise[]; current: number; rest: { endsAt: number; total: number } | null;
}

export type SetField = "weightLbs" | "reps" | "durationSec" | "distanceYd";
export type LiveAction =
  | { t: "confirm"; ex: string; set: string; now: number }
  | { t: "unconfirm"; ex: string; set: string }
  | { t: "adjust"; ex: string; set: string; field: SetField; delta: number }
  | { t: "setRir"; ex: string; set: string; value: number | null }
  | { t: "toggleType"; ex: string; set: string }
  | { t: "abandon"; ex: string; set: string; newId: string }
  | { t: "addSet"; ex: string; id: string }
  | { t: "removeSet"; ex: string; set: string }
  | { t: "addExercise"; exercise: LiveExercise }
  | { t: "swap"; ex: string; name: string }
  | { t: "move"; ex: string; dir: -1 | 1 }
  | { t: "skip"; ex: string; reason: string }
  | { t: "unskip"; ex: string }
  | { t: "cardio"; ex: string; patch: Partial<LiveCardio> }
  | { t: "confirmCardio"; ex: string }
  | { t: "unconfirmCardio"; ex: string }
  | { t: "addRest"; sec: number; now: number }
  | { t: "clearRest" }
  | { t: "focus"; index: number }
  | { t: "tag"; ex: string; tag: string };

const blankSet = (id: string, over: Partial<LiveSet> = {}): LiveSet => ({
  id, setType: "working", weightLbs: null, reps: null, rir: null, durationSec: null, distanceYd: null, done: false, targetRir: null, ...over,
});
const newCardio = (machine: string, plan: PlannedCardio | null): LiveCardio => ({
  machine: plan?.machine ?? machine, minutes: plan?.minutes ?? 10, settings: {}, intervals: plan?.intervals ?? null,
  perceivedEffort: null, talkTest: null, heartRate: null, distanceMi: null, calories: null, done: false, plan,
});

const isDone = (e: LiveExercise) => e.skipped || (e.cardio ? e.cardio.done : e.sets.length > 0 && e.sets.every((s) => s.done));
export const firstOpen = (exs: LiveExercise[]) => { const i = exs.findIndex((e) => !isDone(e)); return i < 0 ? Math.max(0, exs.length - 1) : i; };

/** Build live state from the server session. Logged sets come back confirmed; unlogged prescription rows are prefilled. */
export function fromSession(s: ApiSession, newId: () => string = () => crypto.randomUUID()): LiveState {
  const exercises = [...s.exercises].sort((a, b) => a.orderIndex - b.orderIndex).map((e): LiveExercise => {
    const rx = parsePrescription(e);
    const logged = [...e.sets].sort((a, b) => a.setNumber - b.setNumber);
    const sets: LiveSet[] = logged.map((l) => ({
      id: l.id, setType: l.setType, weightLbs: l.weightLbs, reps: l.reps, rir: l.rir, durationSec: l.durationSec,
      distanceYd: l.distanceYd, done: true, targetRir: null,
    }));
    const covered = logged.filter((l) => l.setType !== "abandoned").length;
    for (const p of rx.slice(covered)) {
      sets.push(blankSet(newId(), { setType: p.setType, weightLbs: p.weight, reps: p.reps, durationSec: p.durationSec, distanceYd: p.distanceYd, targetRir: p.targetRir }));
    }
    const plan = e.unit === "cardio" || e.cardio.length ? plannedCardioFor(s, e) : null;
    const c = e.cardio[0];
    let cardio: LiveCardio | null = null;
    if (c) {
      let settings: CardioSettings = {};
      try { const j = c.settings ? JSON.parse(c.settings) : {}; if (j && typeof j === "object") settings = j; } catch { /* free text */ }
      cardio = {
        machine: c.machine, minutes: c.minutes, settings, intervals: c.intervals, perceivedEffort: c.perceivedEffort,
        talkTest: c.talkTest as LiveCardio["talkTest"], heartRate: c.heartRate, distanceMi: c.distanceMi, calories: c.calories, done: true, plan,
      };
    } else if (e.unit === "cardio" || plan) cardio = newCardio(e.name, plan);
    return {
      id: e.id, name: e.name, muscleGroups: e.muscleGroups, block: e.block, pairGroup: e.pairGroup, unit: e.unit, restSec: e.restSec,
      cue: e.cue, whyTarget: e.aiNotes, sets: cardio ? [] : sets, skipped: e.skipped, skipReason: e.skipReason, added: e.added,
      swappedFrom: e.swappedFrom, cardio, tags: [],
    };
  });
  return { sessionId: s.id, exercises, current: firstOpen(exercises), rest: null };
}

/** Rest only after the last member of a pair (or any non-paired exercise). */
export function restAfter(state: LiveState, ex: LiveExercise): number | null {
  if (!ex.restSec) return null;
  const i = state.exercises.indexOf(ex);
  const next = state.exercises[i + 1];
  return ex.pairGroup && next && next.block === ex.block && next.pairGroup === ex.pairGroup ? null : ex.restSec;
}

const upd = (st: LiveState, exId: string, f: (e: LiveExercise) => LiveExercise): LiveState => ({
  ...st, exercises: st.exercises.map((e) => (e.id === exId ? f(e) : e)),
});
const updSet = (st: LiveState, exId: string, setId: string, f: (s: LiveSet) => LiveSet) =>
  upd(st, exId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? f(s) : s)) }));

export function liveReducer(st: LiveState, a: LiveAction): LiveState {
  switch (a.t) {
    case "confirm": {
      const ex = st.exercises.find((e) => e.id === a.ex);
      if (!ex) return st;
      const set = ex.sets.find((s) => s.id === a.set);
      if (!set) return st;
      let next = updSet(st, a.ex, a.set, (s) => ({ ...s, done: true }));
      const nex = next.exercises.find((e) => e.id === a.ex)!;
      const sec = set.setType === "abandoned" ? null : restAfter(next, nex);
      if (sec) next = { ...next, rest: { endsAt: a.now + sec * 1000, total: sec } };
      if (nex.sets.every((s) => s.done)) next = { ...next, current: firstOpen(next.exercises) };
      return next;
    }
    case "unconfirm": return updSet(st, a.ex, a.set, (s) => ({ ...s, done: false }));
    case "adjust": return updSet(st, a.ex, a.set, (s) => ({ ...s, [a.field]: Math.max(0, (s[a.field] ?? 0) + a.delta) }));
    case "setRir": return updSet(st, a.ex, a.set, (s) => ({ ...s, rir: a.value === s.rir ? null : a.value }));
    case "toggleType": return updSet(st, a.ex, a.set, (s) => ({ ...s, setType: s.setType === "ramp" ? "working" : "ramp" }));
    case "abandon": return upd(st, a.ex, (e) => {
      const i = e.sets.findIndex((s) => s.id === a.set);
      if (i < 0) return e;
      const s = e.sets[i];
      const retry = blankSet(a.newId, { ...s, id: a.newId, setType: s.setType === "abandoned" ? "working" : s.setType, rir: null, done: false });
      const failed: LiveSet = { ...s, setType: "abandoned", reps: null, rir: null, done: true };
      return { ...e, sets: [...e.sets.slice(0, i), failed, retry, ...e.sets.slice(i + 1)] };
    });
    case "addSet": return upd(st, a.ex, (e) => {
      const last = [...e.sets].reverse().find((s) => s.setType !== "abandoned") ?? e.sets[e.sets.length - 1];
      return { ...e, sets: [...e.sets, blankSet(a.id, last ? { ...last, id: a.id, setType: "working", rir: null, done: false } : {})] };
    });
    case "removeSet": return upd(st, a.ex, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== a.set) }));
    case "addExercise": {
      const exercises = [...st.exercises, a.exercise];
      return { ...st, exercises, current: exercises.length - 1 };
    }
    case "swap": return upd(st, a.ex, (e) => ({
      ...e, name: a.name, swappedFrom: e.swappedFrom ?? e.name,
      sets: e.sets.map((s) => (s.done ? s : { ...s, weightLbs: null })),
    }));
    case "move": {
      const i = st.exercises.findIndex((e) => e.id === a.ex);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= st.exercises.length) return st;
      const focus = st.exercises[st.current]?.id;
      const exercises = [...st.exercises];
      [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
      return { ...st, exercises, current: Math.max(0, exercises.findIndex((e) => e.id === focus)) };
    }
    case "skip": {
      const next = upd(st, a.ex, (e) => ({ ...e, skipped: true, skipReason: a.reason }));
      return { ...next, current: firstOpen(next.exercises) };
    }
    case "unskip": return upd(st, a.ex, (e) => ({ ...e, skipped: false, skipReason: null }));
    case "cardio": return upd(st, a.ex, (e) => (e.cardio ? { ...e, cardio: { ...e.cardio, ...a.patch, done: a.patch.done ?? e.cardio.done } } : e));
    case "confirmCardio": {
      const next = upd(st, a.ex, (e) => (e.cardio ? { ...e, cardio: { ...e.cardio, done: true } } : e));
      return { ...next, current: firstOpen(next.exercises) };
    }
    case "unconfirmCardio": return upd(st, a.ex, (e) => (e.cardio ? { ...e, cardio: { ...e.cardio, done: false } } : e));
    case "addRest": return { ...st, rest: { endsAt: (st.rest?.endsAt ?? a.now) + a.sec * 1000, total: (st.rest?.total ?? 0) + a.sec } };
    case "clearRest": return { ...st, rest: null };
    case "focus": return { ...st, current: Math.min(Math.max(0, a.index), st.exercises.length - 1) };
    case "tag": return upd(st, a.ex, (e) => ({ ...e, tags: e.tags.includes(a.tag) ? e.tags : [...e.tags, a.tag] }));
  }
}

// ─── Persistence diff ────────────────────────────────────────────────────────

const base = (sid: string) => `/api/sessions/${sid}`;
export const setBody = (ex: LiveExercise, s: LiveSet, i: number) => ({
  exerciseId: ex.id, setNumber: i + 1, setType: s.setType, weightLbs: s.weightLbs, reps: s.reps, rir: s.rir,
  durationSec: s.durationSec, distanceYd: s.distanceYd,
});
export const cardioBody = (c: LiveCardio) => ({
  machine: c.machine, minutes: c.minutes, settings: Object.keys(c.settings).length ? c.settings : null, intervals: c.intervals,
  perceivedEffort: c.perceivedEffort, talkTest: c.talkTest, heartRate: c.heartRate, distanceMi: c.distanceMi, calories: c.calories,
});
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const isTemp = (id: string) => id.startsWith("tmp-");

/** Mutations that turn the server's view of `prev` into `next`. Only confirmed sets/cardio are persisted. */
export function diffMutations(prev: LiveState, next: LiveState, mid: () => string = () => crypto.randomUUID()): Mutation[] {
  const out: Mutation[] = [];
  const sid = next.sessionId;
  const pm = new Map(prev.exercises.map((e, i) => [e.id, { e, i }]));
  next.exercises.forEach((ex, i) => {
    const was = pm.get(ex.id);
    const m = (x: Omit<Mutation, "id">) => out.push({ id: mid(), ...x });
    if (!was) {
      m({ method: "POST", url: `${base(sid)}/exercises`, body: { id: ex.id.replace(/^tmp-/, ""), name: ex.name, muscleGroups: ex.muscleGroups.split(",").map((g) => g.trim()).filter(Boolean), unit: ex.unit, block: ex.block }, bindTempId: ex.id });
    } else {
      if (was.e.name !== ex.name) m({ key: `ex:${ex.id}:name`, method: "PATCH", url: `${base(sid)}/exercises/${ex.id}`, body: { name: ex.name, swappedFrom: ex.swappedFrom } });
      if (was.e.skipped !== ex.skipped || was.e.skipReason !== ex.skipReason) {
        m({ key: `ex:${ex.id}:skip`, method: "PATCH", url: `${base(sid)}/exercises/${ex.id}`, body: { skipped: ex.skipped, skipReason: ex.skipped ? ex.skipReason : null } });
      }
      if (was.i !== i) m({ key: `ex:${ex.id}:order`, method: "PATCH", url: `${base(sid)}/exercises/${ex.id}`, body: { orderIndex: i } });
    }
    const prevSets = new Map((was?.e.sets ?? []).map((s, k) => [s.id, { s, k }]));
    ex.sets.forEach((s, k) => {
      const p = prevSets.get(s.id);
      const body = setBody(ex, s, k);
      if (s.done && !(p?.s.done && same(setBody(was!.e, p.s, p.k), body))) {
        m({ key: `set:${s.id}`, method: "PUT", url: `${base(sid)}/sets/${s.id}`, body });
      } else if (!s.done && p?.s.done) m({ key: `set:${s.id}`, method: "DELETE", url: `${base(sid)}/sets/${s.id}` });
    });
    for (const [id, p] of prevSets) {
      if (p.s.done && !ex.sets.some((s) => s.id === id)) m({ key: `set:${id}`, method: "DELETE", url: `${base(sid)}/sets/${id}` });
    }
    if (ex.cardio?.done && !(was?.e.cardio?.done && same(cardioBody(was.e.cardio), cardioBody(ex.cardio)))) {
      m({ key: `cardio:${ex.id}`, method: "PUT", url: `${base(sid)}/exercises/${ex.id}/cardio`, body: cardioBody(ex.cardio) });
    }
  });
  return out;
}

/** True when every non-skipped exercise has logged something (used to enable Finish without a warning). */
export const allDone = (st: LiveState) => st.exercises.every(isDone);
