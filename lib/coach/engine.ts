// Public coach-engine API used by API routes and conversation.ts.
// CONTRACT: signatures fixed. Workstream B implements plan/refine/review (in plan.ts / review.ts and re-exports here);
// Workstream C implements research (research.ts). Routes (Workstream D) import only from this file.
import type { SessionPlan, SessionReview, ResearchOut } from "./schemas";

/**
 * Generate today's plan: gather context (context.ts), run rules (session type, targets, layoff, preferences,
 * carry-over skips, emphasis shifts), call MODELS.routine with structured output, validate with SessionPlan
 * (retry once on failure), overwrite estimatedMinutes via rules.estimateDuration, then persist a WorkoutSession
 * (phase "planned", plan JSON snapshot, SessionExercise rows with prescription JSON). Links checkInId if given.
 */
export async function planSession(
  clientId: string, opts: { date: string; checkInId?: string; sessionTypeOverride?: string },
): Promise<{ sessionId: string; plan: SessionPlan }> {
  throw new Error("not implemented");
}

/** Revise a planned session from client text. Saves any stated preference. Rewrites SessionExercise rows. */
export async function refinePlan(
  clientId: string, sessionId: string, message: string,
): Promise<{ plan: SessionPlan; reply: string; savedPreferenceIds: string[] }> {
  throw new Error("not implemented");
}

/**
 * Review a recorded session: rules.nextWorkingWeight per exercise (weights are facts), model writes the review and
 * clarifying questions for ambiguous data (abandoned sets, missing/near-failure RIR, skips, numbers far above estimate).
 * Persists coachReview JSON + ClarifyingQuestion rows.
 */
export async function reviewSession(clientId: string, sessionId: string): Promise<SessionReview> {
  throw new Error("not implemented");
}

/** Store the answer and recompute that exercise's progression (e.g. bench "Nothing left" → rirOverride 0 → 175). */
export async function answerQuestion(
  clientId: string, questionId: string, answer: string,
): Promise<{ progression: { exerciseName: string; nextWeight: number | null; reason: string } | null }> {
  throw new Error("not implemented");
}

/** Run a research task (web search if client.webResearch) and store a ResearchNote. */
export async function research(
  clientId: string, question: string, link?: { proposalId?: string; sessionId?: string },
): Promise<{ researchNoteId: string | null; note: ResearchOut; searched: boolean }> {
  throw new Error("not implemented");
}
