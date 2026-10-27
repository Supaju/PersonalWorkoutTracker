// reviewSession / answerQuestion: rules decide weights and which questions are required; the model words them.
import { db } from "@/lib/db";
import { MODELS } from "./philosophy";
import { buildContext, exerciseHistory, toLoggedSession, type ContextSession } from "./context";
import { callStructured } from "./llm";
import { PRIMARY_LIFTS } from "./plan";
import { buildReviewPrompt, type RequiredQuestion } from "./prompts";
import { nextWorkingWeight, type WeightDecision } from "./rules";
import { SessionReview } from "./schemas";

export const RIR_OPTIONS = ["Had 2–3 left", "Had 1 left", "Nothing left"];
const RIR_BY_ANSWER: Record<string, number> = { "nothing left": 0, "had 1 left": 1, "had 2–3 left": 2, "had 2-3 left": 2 };
const rirFromAnswer = (a: string): number | undefined => RIR_BY_ANSWER[a.trim().toLowerCase()];

const sessionInclude = {
  exercises: { include: { sets: true, cardio: true, feedback: true }, orderBy: { orderIndex: "asc" as const } },
  questions: true,
};

/** Deterministic pre-pass: which questions the client must be asked (criterion 9). */
export function requiredQuestions(
  logged: ContextSession, rows: { name: string; block: string; orderIndex: number; targetWeight: number | null }[],
): RequiredQuestion[] {
  const strength = rows.filter((r) => r.block === "strength").sort((a, b) => a.orderIndex - b.orderIndex);
  const primary = new Set(strength.slice(0, PRIMARY_LIFTS).map((r) => r.name));
  const out: RequiredQuestion[] = [];
  for (const e of logged.exercises) {
    const row = rows.find((r) => r.name === e.name);
    if (e.skipped) {
      out.push({ kind: "skip", exerciseName: e.name, options: ["Ran out of time", "Too tired", "Pain or discomfort", "Equipment issue", "Didn't want to"],
        hint: `${e.name} was skipped${e.skipReason ? ` (${e.skipReason})` : ""}. Ask what got in the way.` });
      continue;
    }
    const working = e.sets.filter((s) => s.setType === "working");
    if (e.sets.some((s) => s.setType === "abandoned")) {
      out.push({ kind: "abandoned", exerciseName: e.name, options: ["Too heavy", "Pain or discomfort", "Equipment issue", "Ran out of time"],
        hint: `Sets were abandoned on ${e.name}. Ask why.` });
    }
    if (primary.has(e.name) && working.length && working.some((s) => s.rir === null || s.rir <= 1)) {
      out.push({ kind: "rir", exerciseName: e.name, options: RIR_OPTIONS,
        hint: `Reps in reserve on ${e.name} is missing or was 1 or less. Ask how many reps the client had left on the last working set.` });
    }
    const top = Math.max(0, ...working.map((s) => s.weight ?? 0));
    if (row?.targetWeight && top > row.targetWeight * 1.15) {
      out.push({ kind: "unexpected", exerciseName: e.name, options: ["Felt strong, went up on purpose", "Different equipment", "Logged it wrong"],
        hint: `${e.name} was ${top}, more than 15% above the planned ${row.targetWeight}. Ask what happened.` });
    }
  }
  return out;
}

export async function reviewSession(clientId: string, sessionId: string): Promise<SessionReview> {
  const row = await db.workoutSession.findFirst({ where: { id: sessionId, clientId }, include: sessionInclude });
  if (!row) throw new Error("Session not found");
  const logged = toLoggedSession(row);
  const ctx = await buildContext(clientId, row.date);
  const history = [...ctx.history.filter((h) => h.id !== logged.id), logged].sort((a, b) => a.date.localeCompare(b.date));
  ctx.history = history;

  const answeredRir = new Map(row.questions.filter((q) => q.kind === "rir" && q.answer && q.exerciseName)
    .map((q) => [q.exerciseName!, rirFromAnswer(q.answer!)]));
  const decisions: WeightDecision[] = logged.exercises
    .filter((e) => e.skipped || e.sets.length > 0)
    .map((e) => nextWorkingWeight(exerciseHistory(history, e.name), { rirOverride: answeredRir.get(e.name) }));
  const required = requiredQuestions(logged, row.exercises);

  const out = await callStructured({
    model: MODELS.routine, schema: SessionReview, ...buildReviewPrompt(ctx, logged, decisions, required),
  });

  const review: SessionReview = {
    ...out,
    progressions: decisions.map((d) => ({
      exerciseName: d.exerciseName, nextWeight: d.nextWeight, nextReps: d.nextReps,
      reason: out.progressions.find((p) => p.exerciseName.toLowerCase() === d.exerciseName.toLowerCase())?.reason ?? d.reason,
    })),
    clarifyingQuestions: required.map((r) => ({
      kind: r.kind, exerciseName: r.exerciseName, options: r.options,
      question: out.clarifyingQuestions.find((q) => q.kind === r.kind && q.exerciseName === r.exerciseName)?.question ?? r.hint,
    })),
  };

  // Keep answered questions on a re-review; replace the unanswered ones.
  await db.clarifyingQuestion.deleteMany({ where: { sessionId, answer: null } });
  const answered = row.questions.filter((q) => q.answer);
  for (const q of review.clarifyingQuestions) {
    if (answered.some((a) => a.kind === q.kind && a.exerciseName === q.exerciseName)) continue;
    await db.clarifyingQuestion.create({
      data: { sessionId, exerciseName: q.exerciseName, kind: q.kind, question: q.question, options: JSON.stringify(q.options) },
    });
  }
  await db.workoutSession.update({ where: { id: sessionId }, data: { coachReview: JSON.stringify(review), reviewedAt: new Date() } });
  return review;
}

export async function answerQuestion(
  clientId: string, questionId: string, answer: string,
): Promise<{ progression: { exerciseName: string; nextWeight: number | null; reason: string } | null }> {
  const q = await db.clarifyingQuestion.findFirst({
    where: { id: questionId, session: { clientId } }, include: { session: { include: sessionInclude } },
  });
  if (!q) throw new Error("Question not found");
  await db.clarifyingQuestion.update({ where: { id: q.id }, data: { answer, answeredAt: new Date() } });
  if (q.kind !== "rir" || !q.exerciseName) return { progression: null };

  const ctx = await buildContext(clientId, q.session.date);
  const logged = toLoggedSession(q.session);
  const history = [...ctx.history.filter((h) => h.id !== logged.id), logged].sort((a, b) => a.date.localeCompare(b.date));
  const d = nextWorkingWeight(exerciseHistory(history, q.exerciseName), { rirOverride: rirFromAnswer(answer) });
  const progression = { exerciseName: d.exerciseName, nextWeight: d.nextWeight, reason: d.reason };

  if (q.session.coachReview) {
    const review = SessionReview.parse(JSON.parse(q.session.coachReview));
    review.progressions = review.progressions.map((p) =>
      p.exerciseName === d.exerciseName ? { ...p, nextWeight: d.nextWeight, nextReps: d.nextReps, reason: d.reason } : p);
    await db.workoutSession.update({ where: { id: q.sessionId }, data: { coachReview: JSON.stringify(review) } });
  }
  return { progression };
}
