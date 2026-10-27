// Deterministic coaching rules. Pure functions, no DB, no model calls. Unit-tested in rules.test.ts.
// Inputs are plain data (see types below) so tests can use fixtures directly.
// CONTRACT: signatures and the behavior described in each doc comment are fixed. Workstream B implements.
import { PROGRESSION, SESSION, READINESS } from "./philosophy";
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

const recorded = (h: LoggedSession[]) => h.filter((s) => s.phase === "recorded");
const addDays = (d: string, n: number) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);
const isHeavy = (t: string) => t === "heavy_fullbody" || t === "reentry" || t === "legacy" || /^(upper|lower)_/.test(t);
const minOf = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? Math.min(...v) : null; };
const decide = (
  exerciseName: string, decision: WeightDecision["decision"], nextWeight: number | null, nextReps: number | null,
  reason: string, flags: WeightDecision["flags"] = [],
): WeightDecision => ({ exerciseName, nextWeight, nextReps, decision, reason, flags });

// ─── Gaps and session selection ──────────────────────────────────────────────

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const t = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86400000);
}

/**
 * Layoff = days since last *recorded* session > layoffDays (strictly greater).
 * Returns { isLayoff, daysSince } where daysSince is null with no history.
 * No history at all counts as a layoff.
 */
export function detectLayoff(
  history: LoggedSession[], today: string, layoffDays: number,
): { isLayoff: boolean; daysSince: number | null } {
  const last = recorded(history).filter((s) => s.date <= today).map((s) => s.date).sort().pop();
  if (!last) return { isLayoff: true, daysSince: null };
  const daysSince = daysBetween(last, today);
  return { isLayoff: daysSince > layoffDays, daysSince };
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
  const { history, today, rotation, minHoursBetweenHeavy, layoffDays, readiness } = input;
  const past = recorded(history).filter((s) => s.date <= today);
  const lay = detectLayoff(past, today, layoffDays);
  if (lay.isLayoff) {
    return { sessionType: "reentry", reasons: [lay.daysSince === null
      ? "No training history yet, so today is a gentle re-entry session."
      : `It has been ${lay.daysSince} days since your last session, so today is a re-entry session at reduced loads.`] };
  }
  let type: SessionType;
  const reasons: string[] = [];
  if (rotation.includes("heavy_fullbody") && rotation.includes("light_conditioning")) {
    const lastHeavy = past.filter((s) => isHeavy(s.sessionType)).map((s) => s.date).sort().pop();
    const hours = lastHeavy ? daysBetween(lastHeavy, today) * 24 : null;
    if (hours !== null && hours < minHoursBetweenHeavy) {
      type = "light_conditioning";
      reasons.push(`Your last heavy session was ${hours / 24} day(s) ago (under ${minHoursBetweenHeavy} hours), so today is light conditioning.`);
    } else {
      type = "heavy_fullbody";
      reasons.push(hours === null
        ? "No recent heavy session on record, so today is a heavy full-body day."
        : `Your last heavy session was ${hours / 24} days ago (at least ${minHoursBetweenHeavy} hours), so today is a heavy full-body day.`);
    }
  } else {
    const lastDone = past.filter((s) => rotation.includes(s.sessionType as SessionType))
      .sort((a, b) => a.date.localeCompare(b.date)).pop();
    const idx = lastDone ? rotation.indexOf(lastDone.sessionType as SessionType) : -1;
    type = rotation[(idx + 1) % rotation.length];
    reasons.push(lastDone ? `Next in the rotation after ${lastDone.sessionType}: ${type}.` : `Start of the rotation: ${type}.`);
  }
  if (type === "heavy_fullbody" && readiness) {
    const n = Object.values(readiness.soreness).filter((v) => v === "significant").length;
    if (readiness.sleep === "poor") {
      type = "light_conditioning";
      reasons.push("Sleep was poor, so the heavy day is swapped for light conditioning.");
    } else if (n >= READINESS.swapHeavyIfSignificantAreas) {
      type = "light_conditioning";
      reasons.push(`${n} areas are significantly sore, so the heavy day is swapped for light conditioning.`);
    }
  }
  return { sessionType: type, reasons };
}

/** Single significantly-sore areas → emphasis-shift instructions from READINESS.emphasisShifts. */
export function emphasisShifts(readiness: ReadinessInput | null): string[] {
  if (!readiness) return [];
  return Object.entries(readiness.soreness)
    .filter(([, v]) => v === "significant")
    .map(([area]) => READINESS.emphasisShifts[area])
    .filter((x): x is string => !!x);
}

/** Muscle groups trained (any working set) in sessions within the last `hours` before `today`. */
export function musclesTrainedRecently(history: LoggedSession[], today: string, hours: number): string[] {
  const out = new Set<string>();
  for (const s of recorded(history)) {
    const d = daysBetween(s.date, today);
    if (d < 0 || d * 24 > hours) continue;
    for (const e of s.exercises) {
      if (e.sets.some((x) => x.setType === "working")) e.muscleGroups.forEach((m) => out.add(m));
    }
  }
  return [...out];
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
  const last = exerciseHistory[exerciseHistory.length - 1];
  if (!last) return decide("", "find_your_number", null, null, "New exercise: find your number by ramping up until you get the target reps with 2–3 reps in reserve.");
  const name = last.exercise.name;
  const workingOf = (e: LoggedExercise) => e.sets.filter((s) => s.setType === "working");
  const topWeight = (e: LoggedExercise) => Math.max(...workingOf(e).map((s) => s.weight ?? 0));

  if (last.exercise.skipped) {
    const prior = [...exerciseHistory].reverse().find((h) => !h.exercise.skipped && workingOf(h.exercise).some((s) => s.weight));
    if (!prior) return decide(name, "find_your_number", null, last.exercise.targetReps, "Skipped last time with no weight on record; find your number.", ["skipped"]);
    const w = topWeight(prior.exercise);
    const kb = last.exercise.unit === "per_hand" && /carry|kettlebell/i.test(name);
    const up = kb
      ? (PROGRESSION.kettlebellLadder.find((r) => r > w) ?? w)
      : Math.max(roundLoad(w * (1 + PROGRESSION.increasePct)), w + PROGRESSION.roundTo);
    return decide(name, "reinstate", up, last.exercise.targetReps,
      `Skipped last time, so it comes back this session at ${up} (one step up from ${w}).`, ["skipped"]);
  }

  const cur = [...exerciseHistory].reverse().find((h) => !h.exercise.skipped && workingOf(h.exercise).length > 0);
  if (!cur) return decide(name, "find_your_number", null, last.exercise.targetReps, "No working sets on record yet; find your number.");
  const ex = cur.exercise;
  const working = workingOf(ex);
  const target = ex.targetReps;
  const flags: WeightDecision["flags"] = [];
  if (ex.sets.some((s) => s.setType === "abandoned")) flags.push("abandoned_sets");
  if (working.some((s) => s.rir === null)) flags.push("rir_missing");
  const hit = (s: LoggedSet) => target === null || (s.reps !== null && s.reps >= target);
  const allHit = working.every(hit);

  if (ex.unit === "bodyweight" || ex.unit === "time" || ex.unit === "distance" || ex.unit === "cardio") {
    if (ex.unit !== "bodyweight") return decide(name, "bodyweight", null, null, "Add a little time or distance per set next time while staying comfortable.", flags);
    const maxReps = Math.max(...working.map((s) => s.reps ?? 0));
    const nextReps = allHit ? Math.max(maxReps, target ?? 0) + 1 : target ?? maxReps;
    return decide(name, "bodyweight", null, nextReps, `Aim for ${nextReps} reps per set next time.`, flags);
  }

  const w = topWeight(ex);
  const minRir = opts?.rirOverride ?? minOf(working.map((s) => s.rir));
  if (allHit) {
    if (minRir !== null && minRir <= PROGRESSION.reduceIfMinRirAtMost) {
      const nw = Math.min(roundLoad(w * (1 - PROGRESSION.reducePct)), w - PROGRESSION.roundTo);
      return decide(name, "reduce", nw, target, `${w} was at your limit (${minRir} reps in reserve), so ${nw} this week.`, flags);
    }
    const cap = Math.floor((w * (1 + PROGRESSION.maxJumpPct)) / PROGRESSION.roundTo) * PROGRESSION.roundTo;
    const raw = Math.max(roundLoad(w * (1 + PROGRESSION.increasePct)), w + PROGRESSION.roundTo);
    const nw = Math.max(Math.min(raw, cap), w + PROGRESSION.roundTo);
    return decide(name, "increase", nw, target, `You hit ${target ?? "the"} reps at ${w} with room to spare, so ${nw} this week.`, flags);
  }

  // Target missed. Look for a big jump inside the session that preceded the miss.
  const seq = ex.sets.filter((s) => s.setType !== "abandoned" && s.weight !== null);
  for (let i = 1; i < seq.length; i++) {
    const s = seq[i];
    if (s.setType === "working" && !hit(s) && s.weight! > seq[i - 1].weight! * (1 + PROGRESSION.bigJumpPct)) {
      const est = estimateWeightForReps(s.weight!, s.reps ?? 1, (target ?? s.reps ?? 1) + 2);
      return decide(name, "reduce", est, target,
        `Jumping from ${seq[i - 1].weight} to ${s.weight} was too big (${s.reps} reps vs ${target}), so ${est} should give about ${(target ?? 0) + 2} reps.`,
        [...flags, "jump_too_big"]);
    }
  }
  const hitSet = [...working].reverse().find(hit);
  if (hitSet && hitSet.weight !== null) {
    return decide(name, "hold", hitSet.weight, target, `Target reps were missed, so hold at ${hitSet.weight} until every set is clean.`, flags);
  }
  const nw = roundLoad(w * (1 - PROGRESSION.reducePct));
  return decide(name, "reduce", nw, target, `Target reps were missed at ${w}, so ${nw} this week.`, flags);
}

/** Brzycki estimate of the weight for `reps` reps given a set of `w` × `r` taken to ~failure. Rounded to 5. */
export function estimateWeightForReps(w: number, r: number, reps: number): number {
  return roundLoad((w * (37 - reps)) / (37 - r));
}

/** Round to the nearest PROGRESSION.roundTo (half rounds up). */
export function roundLoad(w: number): number {
  return Math.round(w / PROGRESSION.roundTo) * PROGRESSION.roundTo;
}

// ─── Plan shaping ────────────────────────────────────────────────────────────

/**
 * Minutes for a plan. Per exercise: sets × SESSION.secondsPerSet + rest after each set
 * (ramp: defaultRestSec.ramp; working: exercise.restSec ?? defaultRestSec.working; within a pair, rest only after the
 * last member) + transitionSecPerExercise. Cardio exercises count cardio.minutes. Returns per-block and total, rounded up.
 */
export function estimateDuration(plan: SessionPlan): { total: number; byBlock: Record<string, number> } {
  const byBlock: Record<string, number> = {};
  let total = 0;
  for (const b of plan.blocks) {
    let sec = 0;
    b.exercises.forEach((e, i) => {
      if (e.cardio) { sec += e.cardio.minutes * 60; return; }
      const lastOfPair = !e.pairGroup || !b.exercises.slice(i + 1).some((o) => o.pairGroup === e.pairGroup);
      sec += SESSION.transitionSecPerExercise;
      for (const s of e.sets) {
        sec += SESSION.secondsPerSet;
        if (lastOfPair) sec += s.setType === "ramp" ? SESSION.defaultRestSec.ramp : (e.restSec ?? SESSION.defaultRestSec.working);
      }
    });
    byBlock[b.block] = (byBlock[b.block] ?? 0) + Math.ceil(sec / 60);
  }
  for (const m of Object.values(byBlock)) total += m;
  return { total, byBlock };
}

export interface PreferenceRow { exerciseName: string; kind: "disliked" | "preferred" | "substitute"; substituteFor: string | null }

/**
 * Filters/rewrites a candidate exercise list: drops disliked (case-insensitive name match),
 * replaces substituteFor names with the substitute. Returns the list and what changed.
 */
export function applyPreferences(
  candidates: string[], prefs: PreferenceRow[],
): { exercises: string[]; changes: string[] } {
  const lc = (x: string) => x.toLowerCase();
  const changes: string[] = [];
  const out: string[] = [];
  for (const c of candidates) {
    let name = c;
    const sub = prefs.find((p) => p.kind === "substitute" && p.substituteFor && lc(p.substituteFor) === lc(c));
    if (sub) { name = sub.exerciseName; changes.push(`${c} replaced with ${name}`); }
    if (prefs.some((p) => p.kind === "disliked" && lc(p.exerciseName) === lc(name))) { changes.push(`${name} dropped (disliked)`); continue; }
    if (!out.some((o) => lc(o) === lc(name))) out.push(name);
  }
  return { exercises: out, changes };
}

/** Exercises skipped last session, with reasons. "time" skips must be fit in next time. */
export function carryOverSkips(last: LoggedSession | null): { name: string; reason: SkipReason | null }[] {
  return (last?.exercises ?? []).filter((e) => e.skipped).map((e) => ({ name: e.name, reason: e.skipReason }));
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
  const { today, trainingDays } = input;
  const todayDow = new Date(today + "T00:00:00Z").getUTCDay();
  const monday = addDays(today, -((todayDow + 6) % 7));
  const known = recorded(input.history).filter((s) => s.date <= today);
  const sim: LoggedSession[] = [...known];
  const out: ReturnType<typeof weekView> = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const weekday = new Date(date + "T00:00:00Z").getUTCDay();
    const done = known.find((s) => s.date === date);
    const training = trainingDays.includes(weekday);
    if (done) { out.push({ date, weekday, status: "done", sessionType: done.sessionType }); continue; }
    if (date < today) { out.push({ date, weekday, status: training ? "missed" : "rest", sessionType: null }); continue; }
    if (!training) { out.push({ date, weekday, status: "rest", sessionType: null }); continue; }
    const { sessionType } = selectSessionType({ ...input, history: sim, today: date, readiness: null });
    sim.push({ date, sessionType, phase: "recorded", exercises: [] });
    out.push({ date, weekday, status: date === today ? "today" : "upcoming", sessionType });
  }
  return out;
}
