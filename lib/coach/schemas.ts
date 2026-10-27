// Shared contracts for the coach engine. Every workstream codes against these.
// Changing a shape here is a contract change: tell the planner.
import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const SessionType = z.enum([
  "heavy_fullbody",
  "light_conditioning",
  "reentry",
  "upper_a",
  "lower_a",
  "upper_b",
  "lower_b",
  "deload",
]);
export type SessionType = z.infer<typeof SessionType>;

export const Block = z.enum(["warmup", "strength", "conditioning", "cooldown"]);
export type Block = z.infer<typeof Block>;

export const SetType = z.enum(["ramp", "working", "abandoned"]);
export type SetType = z.infer<typeof SetType>;

/** How load is expressed for an exercise. per_hand = dumbbell/kettlebell weight in each hand. */
export const LoadUnit = z.enum(["total", "per_hand", "bodyweight", "time", "distance", "cardio"]);
export type LoadUnit = z.infer<typeof LoadUnit>;

export const SkipReason = z.enum(["time", "fatigue", "pain", "equipment", "disliked", "other"]);
export type SkipReason = z.infer<typeof SkipReason>;

export const BodyArea = z.enum([
  "chest", "shoulders", "upper_back", "lats", "biceps", "triceps", "forearms",
  "core", "lower_back", "glutes", "quads", "hamstrings", "adductors", "abductors", "calves",
]);
export type BodyArea = z.infer<typeof BodyArea>;

export const Soreness = z.enum(["none", "mild", "significant"]);
export type Soreness = z.infer<typeof Soreness>;

export const FeedbackTag = z.enum([
  "felt_great", "too_easy", "too_hard", "joint_discomfort", "disliked", "equipment_issue",
]);
export type FeedbackTag = z.infer<typeof FeedbackTag>;

export const TriggerKind = z.enum([
  "scheduled",          // reviewEveryWeeks elapsed since version start / last review
  "ready_to_progress",  // consistent adherence over several weeks
  "stalled_lifts",
  "poor_fit",           // repeated misses or skips for time
  "bodyweight_change",
  "new_consideration",
  "schedule_or_goal_change",
  "setback",            // long layoff while in a later phase
  "client_request",
]);
export type TriggerKind = z.infer<typeof TriggerKind>;

// ─── Check-in ────────────────────────────────────────────────────────────────

export const CheckInInput = z.object({
  kind: z.enum(["pre", "check_out", "next_day"]),
  date: z.string(), // YYYY-MM-DD
  sessionId: z.string().nullish(),
  soreness: z.partialRecord(BodyArea, Soreness).nullish(),
  sleep: z.enum(["poor", "ok", "good"]).nullish(),
  energy: z.enum(["low", "normal", "high"]).nullish(),
  minutesAvailable: z.number().int().positive().nullish(),
  painNotes: z.string().nullish(),
  effort: z.number().int().min(1).max(10).nullish(),
  enjoyment: z.number().int().min(1).max(5).nullish(),
  conditioning: z.enum(["too_easy", "about_right", "too_hard"]).nullish(),
  bodyweightLbs: z.number().positive().nullish(),
  note: z.string().nullish(),
});
export type CheckInInput = z.infer<typeof CheckInInput>;

// ─── Session plan (model output, validated) ──────────────────────────────────

export const PlannedSet = z.object({
  setType: z.enum(["ramp", "working"]),
  weight: z.number().nullable(),      // lb; per hand if unit=per_hand; null for bodyweight
  reps: z.number().int().nullable(),
  targetRir: z.number().int().nullable(), // working sets: 2 or 3
  durationSec: z.number().int().nullable(),
  distanceYd: z.number().nullable(),
});
export type PlannedSet = z.infer<typeof PlannedSet>;

export const PlannedCardio = z.object({
  machine: z.string(),
  minutes: z.number(),
  intervals: z.string().nullable(),   // "5 x 1 min hard / 1 min easy"
  settings: z.string().nullable(),    // "level 6–8 hard, 3 easy"
  targetEffort: z.string(),           // talk-test description
});

export const PlannedExercise = z.object({
  name: z.string(),
  muscleGroups: z.array(z.string()),
  pairGroup: z.string().nullable(),   // "A" → shown as A1/A2 by order within block
  unit: LoadUnit,
  restSec: z.number().int().nullable(), // rest after this exercise (or after the pair, on the last member)
  cue: z.string(),                      // one line
  whyTarget: z.string().nullable(),     // "185 was at your limit, so 175 this week"
  sets: z.array(PlannedSet),
  cardio: PlannedCardio.nullable(),
});
export type PlannedExercise = z.infer<typeof PlannedExercise>;

export const PlannedBlock = z.object({
  block: Block,
  estimatedMinutes: z.number(),
  exercises: z.array(PlannedExercise),
});
export type PlannedBlock = z.infer<typeof PlannedBlock>;

export const SessionPlan = z.object({
  sessionType: SessionType,
  name: z.string(),              // "Heavy full body"
  coachNotes: z.string(),        // 1–2 sentences: why today looks like this
  estimatedMinutes: z.number(),  // recomputed by rules.estimateDuration and overwritten
  blocks: z.array(PlannedBlock),
});
export type SessionPlan = z.infer<typeof SessionPlan>;

// ─── Post-session review (model output, validated) ───────────────────────────

export const ClarifyingQuestionOut = z.object({
  kind: z.enum(["rir", "abandoned", "skip", "unexpected", "other"]),
  exerciseName: z.string().nullable(),
  question: z.string(),
  options: z.array(z.string()), // quick replies; UI always adds free text
});
export type ClarifyingQuestionOut = z.infer<typeof ClarifyingQuestionOut>;

export const SessionReview = z.object({
  summary: z.string(), // one line for history list
  highlights: z.array(z.string()),
  progressions: z.array(z.object({
    exerciseName: z.string(),
    nextWeight: z.number().nullable(),
    nextReps: z.number().int().nullable(),
    reason: z.string(),
  })), // weights come from rules.nextWorkingWeight; the model only words the reason
  decisionsNeeded: z.array(z.string()),
  clarifyingQuestions: z.array(ClarifyingQuestionOut),
});
export type SessionReview = z.infer<typeof SessionReview>;

// ─── Program ─────────────────────────────────────────────────────────────────

export const ProgramStructure = z.object({
  phase: z.string(),
  description: z.string(),
  /** Session type per training-day slot, cycled in order. heavy/light: ["heavy_fullbody","light_conditioning"]. */
  rotation: z.array(SessionType),
  sessionTypes: z.record(z.string(), z.object({
    label: z.string(),
    focus: z.string(),
    exercisePool: z.array(z.string()),
  })),
  progression: z.string(),
  conditioning: z.string(),
  minHoursBetweenHeavy: z.number().default(48),
});
export type ProgramStructure = z.infer<typeof ProgramStructure>;

export const ProposalOut = z.object({
  observations: z.array(z.string()), // each cites numbers from the logs
  recommendation: z.string(),
  rationale: z.string(),
  weekToWeek: z.string(),
  expectedBenefit: z.string(),
  tradeOffs: z.string(),
  structure: ProgramStructure,
});
export type ProposalOut = z.infer<typeof ProposalOut>;

export const ResearchOut = z.object({
  summary: z.string(),
  applicationToClient: z.string(),
  confidence: z.enum(["low", "moderate", "high"]),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
  seeDoctor: z.boolean(),
});
export type ResearchOut = z.infer<typeof ResearchOut>;

// ─── Coach conversation ──────────────────────────────────────────────────────

/** What the coach did in a turn; persisted on CoachMessage.action and rendered as a card. */
export const CoachAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("plan_created"), sessionId: z.string() }),
  z.object({ type: z.literal("plan_updated"), sessionId: z.string() }),
  z.object({ type: z.literal("preference_saved"), preferenceId: z.string(), exerciseName: z.string(), kind: z.string() }),
  z.object({ type: z.literal("schedule_updated") }),
  z.object({ type: z.literal("consideration_saved"), considerationId: z.string() }),
  z.object({ type: z.literal("review_created"), sessionId: z.string() }),
  z.object({ type: z.literal("proposal_created"), proposalId: z.string() }),
  z.object({ type: z.literal("research_saved"), researchNoteId: z.string() }),
  z.object({ type: z.literal("checkin_saved"), checkInId: z.string() }),
]);
export type CoachAction = z.infer<typeof CoachAction>;
