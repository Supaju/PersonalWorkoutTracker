// Client-side shapes of the session API responses plus small shared helpers. JSON dates arrive as strings.
import type { PlannedSet, PlannedCardio, SessionPlan, SessionReview, SetType, LoadUnit } from "@/lib/coach/schemas";

export type { PlannedSet, PlannedCardio, SessionPlan, SessionReview, SetType, LoadUnit };

export interface ApiSet {
  id: string; exerciseId: string; setNumber: number; setType: SetType;
  weightLbs: number | null; reps: number | null; rir: number | null;
  durationSec: number | null; distanceYd: number | null; notes: string | null;
}
export interface ApiCardio {
  id: string; exerciseId: string; machine: string; minutes: number; settings: string | null; intervals: string | null;
  perceivedEffort: number | null; talkTest: string | null; heartRate: number | null; distanceMi: number | null;
  calories: number | null; notes: string | null;
}
export interface ApiExercise {
  id: string; sessionId: string; name: string; muscleGroups: string; block: string; pairGroup: string | null;
  unit: LoadUnit; restSec: number | null; cue: string | null; prescription: string | null; orderIndex: number;
  aiNotes: string | null; added: boolean; swappedFrom: string | null; skipped: boolean; skipReason: string | null;
  sets: ApiSet[]; cardio: ApiCardio[]; feedback?: { id: string; tags: string }[];
}
export interface ApiQuestion {
  id: string; sessionId: string; exerciseName: string | null; kind: string; question: string;
  options: string; answer: string | null;
}
export interface ApiSession {
  id: string; date: string; sessionType: string; phase: "planned" | "active" | "recorded"; name: string | null;
  estimatedMinutes: number | null; durationMin: number | null; startedAt: string | null; finishedAt: string | null;
  notes: string | null; coachNotes: string | null; plan: string | null; coachReview: string | null; reviewedAt: string | null;
  exercises: ApiExercise[]; questions?: ApiQuestion[];
}
export interface WeekDay { date: string; weekday: number; status: "done" | "today" | "upcoming" | "rest" | "missed"; sessionType: string | null }
export interface Preference { id: string; exerciseName: string; kind: "disliked" | "preferred" | "substitute"; substituteFor: string | null }

export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
export const parsePlan = (s: ApiSession) => safeJson<SessionPlan | null>(s.plan, null);
export const parsePrescription = (e: ApiExercise) => safeJson<PlannedSet[]>(e.prescription, []);
export const parseReview = (s: ApiSession) => safeJson<SessionReview | null>(s.coachReview, null);

/** Planned cardio lives only in session.plan; plan blocks flatten in the same order as exercise orderIndex at plan time. */
export function plannedCardioFor(s: ApiSession, e: ApiExercise): PlannedCardio | null {
  const flat = parsePlan(s)?.blocks.flatMap((b) => b.exercises) ?? [];
  const byIdx = flat[e.orderIndex];
  const hit = byIdx && (byIdx.name === e.name || byIdx.name === e.swappedFrom) ? byIdx : flat.find((x) => x.name === e.name);
  return hit?.cardio ?? null;
}

export const SESSION_LABEL: Record<string, string> = {
  heavy_fullbody: "Heavy full body", light_conditioning: "Light + conditioning", reentry: "Re-entry",
  upper_a: "Upper A", lower_a: "Lower A", upper_b: "Upper B", lower_b: "Lower B", deload: "Deload", legacy: "Workout", manual: "Workout",
};
export const sessionLabel = (t: string | null | undefined) => (t ? SESSION_LABEL[t] ?? t.replace(/_/g, " ") : "Workout");

export const BLOCK_LABEL: Record<string, string> = { warmup: "Warm-up", strength: "Strength", conditioning: "Conditioning", cooldown: "Cool-down" };
export const BLOCK_ORDER = ["warmup", "strength", "conditioning", "cooldown"];

/** "A1"/"A2" labels by order within a pair group in a block. */
export function pairLabels(exs: { block: string; pairGroup: string | null }[]): (string | null)[] {
  const seen = new Map<string, number>();
  return exs.map((e) => {
    if (!e.pairGroup) return null;
    const k = `${e.block}:${e.pairGroup}`;
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return `${e.pairGroup}${n}`;
  });
}

export const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Load text for a unit: "175 lb", "50 lb/hand", "BW". */
export function loadText(unit: LoadUnit, w: number | null): string {
  if (unit === "bodyweight") return w ? `BW +${w}` : "BW";
  if (w == null) return "";
  return unit === "per_hand" ? `${w} lb/hand` : `${w} lb`;
}
