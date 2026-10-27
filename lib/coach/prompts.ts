// Prompt builders. System = persona + philosophy + client considerations/preferences. User = precomputed facts + history.
import { PHILOSOPHY, DEFAULT_PERSONA } from "./philosophy";
import type { CoachContext, ContextSession } from "./context";
import type { WeightDecision } from "./rules";
import type { SessionPlan, SessionType } from "./schemas";

export interface PlanFacts {
  sessionType: SessionType;
  reasons: string[];
  layoff: { isLayoff: boolean; daysSince: number | null };
  /** Per-exercise targets from rules.nextWorkingWeight (the exercise pool after preferences). */
  targets: WeightDecision[];
  /** Exercises available for this session type after preferences. */
  pool: string[];
  preferenceChanges: string[];
  carryOver: { name: string; reason: string | null }[];
  emphasisShifts: string[];
  recentMuscles: string[];
  minutesAvailable: number;
  hardCapMinutes: number;
}

const list = (xs: readonly string[]) => xs.map((x) => `- ${x}`).join("\n");

export function systemPrompt(ctx: CoachContext): string {
  const p = ctx.profile;
  const parts = [
    `You are a personal trainer coaching ${ctx.client.name}.`,
    `Voice: ${ctx.client.persona || DEFAULT_PERSONA}`,
    p ? `Client: age ${p.age}, ${p.gender}, ${p.heightIn} in, ${p.weightLbs} lb, goal ${p.goals}${p.goalNotes ? ` (${p.goalNotes})` : ""}.` : "",
    `Session design:\n${list(PHILOSOPHY.sessionDesign)}`,
    `Weekly structure:\n${list(PHILOSOPHY.weekly)}`,
    `Load:\n${list(PHILOSOPHY.load)}`,
    `Safety:\n${list(PHILOSOPHY.safety)}`,
    `Voice and review:\n${list(PHILOSOPHY.voice)}`,
    ctx.considerations.length ? `Client considerations (always respect):\n${list(ctx.considerations.map((c) => `[${c.category}] ${c.text}`))}` : "",
    ctx.preferences.length
      ? `Exercise preferences:\n${list(ctx.preferences.map((x) =>
          x.kind === "disliked" ? `Never program: ${x.exerciseName}`
          : x.kind === "substitute" ? `Use ${x.exerciseName} instead of ${x.substituteFor}`
          : `Prefers: ${x.exerciseName}`))}`
      : "",
    ctx.equipment.length ? `Equipment available: ${ctx.equipment.map((e) => e.name).join(", ")}.` : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

const fmtSet = (s: { setType: string; weight: number | null; reps: number | null; rir: number | null; durationSec?: number | null; distanceYd?: number | null }) =>
  `${s.setType[0]}:${s.weight ?? "bw"}x${s.reps ?? (s.durationSec ? `${s.durationSec}s` : s.distanceYd ? `${s.distanceYd}yd` : "?")}${s.rir !== null ? `@${s.rir}` : ""}`;

/** Compact history: one line per exercise. r=ramp, w=working, a=abandoned; @n = reps in reserve. */
export function summarizeHistory(sessions: ContextSession[], limit = 4): string {
  return sessions.slice(-limit).map((s) => {
    const lines = s.exercises.map((e) =>
      e.skipped ? `  ${e.name}: SKIPPED (${e.skipReason ?? "no reason"})` : `  ${e.name}: ${e.sets.map(fmtSet).join(", ") || "no sets logged"}`);
    return `${s.date} ${s.sessionType}${s.name ? ` "${s.name}"` : ""}\n${lines.join("\n")}`;
  }).join("\n") || "No recorded sessions.";
}

const fmtTarget = (d: WeightDecision) =>
  `- ${d.exerciseName}: ${d.nextWeight === null ? "no target weight (find your number)" : `${d.nextWeight}`}${d.nextReps ? ` x ${d.nextReps} reps` : ""} [${d.decision}] ${d.reason}`;

export function buildPlanPrompt(ctx: CoachContext, facts: PlanFacts): { system: string; user: string } {
  const user = [
    `Plan the session for ${ctx.date}.`,
    `Session type: ${facts.sessionType}.`,
    `Why: ${facts.reasons.join(" ")}`,
    facts.layoff.isLayoff ? `Layoff: ${facts.layoff.daysSince ?? "unknown"} days since the last session. Re-entry means roughly 50–60% of the old target weights for working sets, ramped from lighter loads, and gentle conditioning.` : "",
    `Time: ${facts.minutesAvailable} minutes available (hard cap ${facts.hardCapMinutes}). Give estimatedMinutes per block and in total; the total must not exceed ${facts.minutesAvailable}.`,
    `Exercise pool for this session type (choose from it; you may omit some to fit the time): ${facts.pool.join(", ") || "choose suitable exercises"}.`,
    facts.preferenceChanges.length ? `Preference changes already applied: ${facts.preferenceChanges.join("; ")}.` : "",
    facts.targets.length ? `Target weights (use exactly as given for the working sets; do not recompute):\n${facts.targets.map(fmtTarget).join("\n")}` : "",
    facts.carryOver.length ? `Skipped last session, must be included this time (trim ramp sets or re-pair to fit): ${facts.carryOver.map((c) => `${c.name} (${c.reason ?? "no reason"})`).join(", ")}.` : "",
    facts.emphasisShifts.length ? `Soreness adjustments:\n${list(facts.emphasisShifts)}` : "",
    facts.recentMuscles.length ? `Muscles trained in the last 48 hours (do not train these hard today): ${facts.recentMuscles.join(", ")}.` : "",
    ctx.checkIn?.painNotes ? `Client pain notes: ${ctx.checkIn.painNotes}` : "",
    ctx.checkIn?.note ? `Client note: ${ctx.checkIn.note}` : "",
    `Recent history (r ramp, w working, a abandoned, @n reps in reserve):\n${summarizeHistory(ctx.history)}`,
    [
      "Output rules:",
      "- Blocks in order: warmup, strength, conditioning, cooldown.",
      "- Ramp sets (setType ramp) on primary lifts only; later lifts get none or few. Working sets have targetRir 2 or 3.",
      "- Pair non-competing exercises with a shared pairGroup letter (A, B, ...). Put paired exercises next to each other in the block.",
      "- Conditioning exercises use the cardio object with minutes, intervals and a talk-test targetEffort; their sets array is empty.",
      "- Set whyTarget on every exercise that has a target weight above, quoting the reason in plain words.",
      "- Cue is one short line. coachNotes is 1–2 sentences on why today looks like this.",
    ].join("\n"),
  ];
  return { system: systemPrompt(ctx), user: user.filter(Boolean).join("\n\n") };
}

export interface RequiredQuestion { kind: "rir" | "abandoned" | "skip" | "unexpected"; exerciseName: string; hint: string; options: string[] }

export function buildReviewPrompt(
  ctx: CoachContext, session: ContextSession, decisions: WeightDecision[], required: RequiredQuestion[] = [],
): { system: string; user: string } {
  const user = [
    `Review the session on ${session.date} (${session.sessionType}).`,
    `What was logged (r ramp, w working, a abandoned, @n reps in reserve):\n${summarizeHistory([session], 1)}`,
    `Next-time targets, computed by the rules (use these numbers exactly; you only word the reasons):\n${decisions.map(fmtTarget).join("\n")}`,
    required.length
      ? `Ask exactly these clarifying questions, one per item, worded warmly in one sentence. Use the given kind, exerciseName and options unchanged:\n${required.map((q) => `- kind ${q.kind}, exercise ${q.exerciseName}, options ${JSON.stringify(q.options)}: ${q.hint}`).join("\n")}`
      : "No clarifying questions are needed; return an empty clarifyingQuestions array.",
    `Earlier history for context:\n${summarizeHistory(ctx.history.filter((h) => h.id !== session.id), 3)}`,
    "Output: summary is one line for a history list. highlights are 2–4 short items. progressions has one entry per exercise above with the given nextWeight and nextReps and a one-sentence reason. decisionsNeeded lists anything that needs the client's input.",
  ];
  return { system: systemPrompt(ctx), user: user.join("\n\n") };
}

export function buildRefinePrompt(
  ctx: CoachContext, plan: SessionPlan, message: string, targets: WeightDecision[],
): { system: string; user: string } {
  const user = [
    `The client asked to change today's planned session (${ctx.date}).`,
    `Current plan JSON:\n${JSON.stringify(plan)}`,
    `Client message: ${message}`,
    targets.length ? `Target weights stay as computed (use exactly):\n${targets.map(fmtTarget).join("\n")}` : "",
    PHILOSOPHY.voice[2],
    "Return the full revised plan, a short reply to the client (1–3 sentences), and savedPreferences: one entry for each exercise the client dislikes or wants swapped, else an empty array. kind disliked: exerciseName is the disliked exercise. kind substitute: exerciseName is the replacement and substituteFor is the original. Keep the same output rules as for planning: warmup, strength, conditioning, cooldown blocks; pairGroup letters; ramp sets on primary lifts only.",
  ];
  return { system: systemPrompt(ctx), user: user.filter(Boolean).join("\n\n") };
}
