// Public coach-engine API used by API routes and conversation.ts.
// CONTRACT: signatures fixed. Workstream B implements plan/refine/review (in plan.ts / review.ts and re-exports here);
// Workstream C implements research (research.ts). Routes (Workstream D) import only from this file.
import type { ResearchOut } from "./schemas";

export { planSession, refinePlan } from "./plan";
export { reviewSession, answerQuestion } from "./review";

/** Run a research task (web search if client.webResearch) and store a ResearchNote. */
export async function research(
  clientId: string, question: string, link?: { proposalId?: string; sessionId?: string },
): Promise<{ researchNoteId: string | null; note: ResearchOut; searched: boolean }> {
  throw new Error("not implemented");
}
