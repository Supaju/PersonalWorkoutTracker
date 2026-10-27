// Deterministic coaching rules. Pure functions, no DB, no model calls. Unit-tested in rules.test.ts.
// Inputs are plain data (see types below) so tests can use fixtures directly.
// CONTRACT: signatures and the behavior described in each doc comment are fixed. Workstream B implements.
import type { SessionType, SetType, LoadUnit, BodyArea, Soreness, SkipReason, SessionPlan } from "./schemas";

// ─── Input shapes ────────────────────────────────────────────────────────────

export interface LoggedSet {
  setType: SetType;
  weight: number | null; // per hand when unit = per_hand
  reps: number | null;
  rir: number | null;    // null = not recorded
  durationSec?: number | null;
  distanceYd?: number | null;
}

export interface LoggedExercise {
  name: string;
  unit: LoadUnit;
  muscleGroups: string[];
  targetReps: number | null; // working-set rep target from the plan
  skipped: boolean;
  skipReason: SkipReason | null;
  sets: LoggedSet[];
}

export interface LoggedSession {
  date: string; // YYYY-MM-DD
  sessionType: SessionType | "legacy" | string;
  phase: "planned" | "active" | "recorded";
  exercises: LoggedExercise[];
}

export interface ReadinessInput {
  sleep: "poor" | "ok" | "good" | null;
  energy: "low" | "normal" | "high" | null;
  soreness: Partial<Record<BodyArea, Soreness>>;
  minutesAvailable: number | null;
}

// ─── Gaps and session selection ──────────────────────────────────────────────

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  throw new Error("not implemented");
}

/**
 * Layoff = days since last *recorded* session > layoffDays (strictly greater).
 * Returns { isLayoff, daysSince } where daysSince is null with no history.
 * No history at all counts as a layoff.
 */
export function detectLayoff(
  history: LoggedSession[], today: string, layoffDays: number,
): { isLayoff: boolean; daysSince: number | null } {
  throw new Error("not implemented");
}

/**
 * Picks today's session type. Order of rules:
 * 1. detectLayoff → "reentry".
 * 2. Phase heavy_light_fullbody (rotation [heavy_fullbody, light_conditioning]):
 *    "heavy" sessions = heavy_fullbody | reentry | legacy upper/lower types.
 *    If the last heavy session was < minHoursBetweenHeavy (48h → < 2 days) ago → light_conditioning, else heavy_fullbody.
 *    (10/22 after 10/21 → light; 10/26 after 10/22 light & 10/21 heavy → heavy; Tue after Mon heavy → light; Thu → heavy.)
 * 3. Rotation phases (e.g. upper_lower_4day): next type after the last recorded rotation member; missed days never advance it.
 * 4. Readiness: if result is heavy_fullbody and (sleep = poor or >= READINESS.swapHeavyIfSignificantAreas areas significant)
 *    → light_conditioning with reason.
 * Returns the type plus one-sentence reasons (fed to the prompt as facts).
 */
export function selectSessionType(input: {
  history: LoggedSession[];
  today: string;
  rotation: SessionType[];
  minHoursBetweenHeavy: number;
  layoffDays: number;
  readiness: ReadinessInput | null;
}): { sessionType: SessionType; reasons: string[] } {
  throw new Error("not implemented");
}

/** Single significantly-sore areas → emphasis-shift instructions from READINESS.emphasisShifts. */
export function emphasisShifts(readiness: ReadinessInput | null): string[] {
  throw new Error("not implemented");
}

/** Muscle groups trained (any working set) in sessions within the last `hours` before `today`. */
export function musclesTrainedRecently(history: LoggedSession[], today: string, hours: number): string[] {
  throw new Error("not implemented");
}

// ─── Load progression ────────────────────────────────────────────────────────

export interface WeightDecision {
  exerciseName: string;
  nextWeight: number | null;
  nextReps: number | null;
  decision: "increase" | "reduce" | "hold" | "find_your_number" | "reinstate" | "bodyweight";
  reason: string; // one sentence, e.g. "185 was at your limit on set 2 (0 RIR), so 175 this week."
  flags: ("jump_too_big" | "abandoned_sets" | "rir_missing" | "skipped")[];
}

/**
 * Next working weight for one exercise from its history (oldest → newest), last exposure decides.
 * Ignores ramp and abandoned sets. Rules (PROGRESSION):
 * - No prior working sets → find_your_number (nextWeight null).
 * - Last exposure skipped → reinstate at the next weight up from its last logged working weight
 *   (per_hand kettlebell: next rung of kettlebellLadder, e.g. 45 → 53).
 * - All working sets reps >= targetReps and min RIR >= 2 (or RIR null on all) → increase:
 *   round(w * (1 + increasePct)) to roundTo, at least +roundTo, at most +maxJumpPct.
 *   Examples: 380 → 400, 120 → 125, 160 → 170, 50 (per hand) → 55.
 * - Target hit but any working set RIR <= 1 → reduce: round(w * (1 - reducePct)). 185 → 175.
 * - Target missed → if a big jump (> bigJumpPct over the previous working/ramp weight in the same session) preceded the miss,
 *   flag jump_too_big and estimate the weight for (targetReps + 2) reps via Brzycki:
 *   1RM = w * 36 / (37 - reps); est = 1RM * (37 - (targetReps + 2)) / 36, rounded. 180 × 6, target 10 → 145.
 *   Otherwise hold the last working weight that hit target, or reduce 5% if none did.
 * - Any abandoned sets → flag abandoned_sets. Any working set with rir null → flag rir_missing.
 * - unit bodyweight/time/distance: progress reps/duration by small steps, decision "bodyweight".
 * `rirOverride` replaces the min RIR of the last exposure (from an answered clarifying question).
 */
export function nextWorkingWeight(
  exerciseHistory: { date: string; exercise: LoggedExercise }[],
  opts?: { rirOverride?: number },
): WeightDecision {
  throw new Error("not implemented");
}

/** Brzycki estimate of the weight for `reps` reps given a set of `w` × `r` taken to ~failure. Rounded to 5. */
export function estimateWeightForReps(w: number, r: number, reps: number): number {
  throw new Error("not implemented");
}

/** Round to the nearest PROGRESSION.roundTo (half rounds up). */
export function roundLoad(w: number): number {
  throw new Error("not implemented");
}

// ─── Plan shaping ────────────────────────────────────────────────────────────

/**
 * Minutes for a plan. Per exercise: sets × SESSION.secondsPerSet + rest after each set
 * (ramp: defaultRestSec.ramp; working: exercise.restSec ?? defaultRestSec.working; within a pair, rest only after the
 * last member) + transitionSecPerExercise. Cardio exercises count cardio.minutes. Returns per-block and total, rounded up.
 */
export function estimateDuration(plan: SessionPlan): { total: number; byBlock: Record<string, number> } {
  throw new Error("not implemented");
}

export interface PreferenceRow { exerciseName: string; kind: "disliked" | "preferred" | "substitute"; substituteFor: string | null }

/**
 * Filters/rewrites a candidate exercise list: drops disliked (case-insensitive name match),
 * replaces substituteFor names with the substitute. Returns the list and what changed.
 */
export function applyPreferences(
  candidates: string[], prefs: PreferenceRow[],
): { exercises: string[]; changes: string[] } {
  throw new Error("not implemented");
}

/** Exercises skipped last session, with reasons. "time" skips must be fit in next time. */
export function carryOverSkips(last: LoggedSession | null): { name: string; reason: SkipReason | null }[] {
  throw new Error("not implemented");
}

// ─── Weekly view ─────────────────────────────────────────────────────────────

export type DayStatus = "done" | "today" | "upcoming" | "rest" | "missed";

/**
 * Week (Mon–Sun containing `today`) laid out per trainingDays (0=Sun…6=Sat).
 * Training day in the past with no recorded session → missed. Recorded session on any day → done (with its type).
 * Upcoming training days get projected types by simulating selectSessionType forward from history
 * (assume each upcoming day is completed as projected).
 * Fixture: week of 10/26 with [1,2,4,5] → Mon heavy (done), Tue light, Wed rest, Thu heavy, Fri light, Sat/Sun rest.
 * Week of 10/19: Fri 10/23 → missed (10/21 Wed and 10/22 Thu were trained off-schedule → done).
 */
export function weekView(input: {
  history: LoggedSession[];
  today: string;
  trainingDays: number[];
  rotation: SessionType[];
  minHoursBetweenHeavy: number;
  layoffDays: number;
}): { date: string; weekday: number; status: DayStatus; sessionType: SessionType | string | null }[] {
  throw new Error("not implemented");
}
