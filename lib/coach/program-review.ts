// Program evolution. Deterministic trigger detection (unit-tested) + model-written proposals.
// CONTRACT: signatures fixed. Workstream C implements.
import type { LoggedSession } from "./rules";
import type { TriggerKind, ProgramStructure } from "./schemas";

export interface TrendInput {
  today: string;
  history: LoggedSession[];             // all recorded sessions, oldest → newest
  trainingDays: number[];               // 0=Sun…6=Sat
  currentPhase: string;
  versionStartDate: string;
  lastReviewDate: string | null;        // last ProgramProposal.createdAt (any status), YYYY-MM-DD
  reviewEveryWeeks: number;
  bodyweights: { date: string; lbs: number }[];
  considerationsAddedSince: number;     // active considerations created after lastReviewDate
  scheduleOrGoalChangedSince: boolean;
  clientRequested: boolean;
  rejected: { fingerprint: string; decidedAt: string }[];
}

export interface Trends {
  adherence: { weekStart: string; planned: number; completed: number }[]; // last PROGRAM_REVIEW.adherenceWindowWeeks full weeks
  adherenceRate: number;
  consecutiveConsistentWeeks: number;   // trailing full weeks with completed >= planned
  stalledLifts: { name: string; weight: number; exposures: number }[];
  timeSkips: number;
  bodyweightChangePct: number | null;
  daysSinceLastSession: number | null;
}

/** Multi-week trends from logs. Pure. */
export function computeTrends(input: TrendInput): Trends {
  throw new Error("not implemented");
}

/**
 * Deterministic triggers (PROGRAM_REVIEW thresholds):
 * - scheduled: >= reviewEveryWeeks since max(versionStartDate, lastReviewDate)
 * - ready_to_progress: phase heavy_light_fullbody, >= 4 consecutive consistent weeks, adherenceRate >= 0.85
 * - stalled_lifts, poor_fit, bodyweight_change, new_consideration, schedule_or_goal_change, client_request
 * - setback: daysSinceLastSession >= setbackDays and currentPhase !== "heavy_light_fullbody"
 * Fixture extension A (5 more consistent weeks) → includes ready_to_progress.
 * Fixture extension B (3-week layoff after week 5, phase upper_lower_4day) → includes setback.
 */
export function detectTriggers(input: TrendInput, trends: Trends): TriggerKind[] {
  throw new Error("not implemented");
}

/** Phase the coach should propose for the given triggers (setback → heavy_light_fullbody; ready_to_progress from heavy/light → upper_lower_4day). Null = let the model decide. */
export function targetPhase(currentPhase: string, triggers: TriggerKind[]): string | null {
  throw new Error("not implemented");
}

export function proposalFingerprint(proposedPhase: string, triggers: TriggerKind[]): string {
  throw new Error("not implemented");
}

/**
 * True if a proposal with this fingerprint was rejected and there is no new evidence:
 * rejected within PROGRAM_REVIEW.rejectionCooldownWeeks, and triggers contain nothing beyond the rejected
 * proposal's own primary trigger + "scheduled".
 */
export function isSuppressed(fingerprint: string, triggers: TriggerKind[], input: TrendInput): boolean {
  throw new Error("not implemented");
}

/**
 * Full review for a client: load data, compute trends + triggers, (optionally) research, ask the deep model for a
 * ProposalOut, store a pending ProgramProposal. Returns null when no trigger fires or the proposal is suppressed.
 * Never changes the current ProgramVersion.
 */
export async function runProgramReview(
  clientId: string, opts: { today: string; clientRequested?: boolean },
): Promise<{ proposalId: string } | { proposalId: null; reason: string }> {
  throw new Error("not implemented");
}

/** Accept → close current version (endDate) and create version+1 from the proposal structure; mark accepted. Reject → mark rejected with response. */
export async function decideProposal(
  clientId: string, proposalId: string, decision: "accept" | "reject", response?: string,
): Promise<{ versionId: string | null }> {
  throw new Error("not implemented");
}

export type { ProgramStructure };
