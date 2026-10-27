// planSession / refinePlan: rules decide the facts, the model writes the plan, rules overwrite anything numeric.
import { z } from "zod";
import { db } from "@/lib/db";
import { MODELS } from "./philosophy";
import { buildContext, exerciseHistory, type CoachContext } from "./context";
import { callStructured } from "./llm";
import { buildPlanPrompt, buildRefinePrompt, type PlanFacts } from "./prompts";
import {
  applyPreferences, carryOverSkips, detectLayoff, emphasisShifts, estimateDuration, musclesTrainedRecently,
  nextWorkingWeight, selectSessionType, type PreferenceRow, type WeightDecision,
} from "./rules";
import { SessionPlan, SessionType } from "./schemas";

const DEFAULT_ROTATION: SessionType[] = ["heavy_fullbody", "light_conditioning"];

const RefineOut = z.object({
  plan: SessionPlan,
  reply: z.string(),
  savedPreferences: z.array(z.object({
    exerciseName: z.string(),
    kind: z.enum(["disliked", "substitute"]),
    substituteFor: z.string().nullable(),
  })),
});

/** The first N strength-block exercises are the primary lifts: they keep ramp sets and always get RIR questions. */
export const PRIMARY_LIFTS = 2;

const lc = (s: string) => s.toLowerCase();

function decisionFor(ctx: CoachContext, name: string): WeightDecision | null {
  const h = exerciseHistory(ctx.history, name);
  return h.length ? nextWorkingWeight(h) : null;
}

/**
 * Post-process a model plan. Returns the plan plus the blocks that became empty after dropping disliked exercises.
 * - drops disliked exercises
 * - overwrites working-set weights from nextWorkingWeight (not on re-entry days, where the model scales for the layoff)
 * - recomputes minutes; if over budget, trims ramp sets on non-primary lifts (ponytail: primary = first PRIMARY_LIFTS strength exercises)
 */
export function finalizePlan(
  ctx: CoachContext, raw: SessionPlan, sessionType: SessionType, minutesAvailable: number,
): { plan: SessionPlan; emptied: string[]; dropped: string[] } {
  const disliked = new Set(ctx.preferences.filter((p) => p.kind === "disliked").map((p) => lc(p.exerciseName)));
  const dropped: string[] = [];
  const emptied: string[] = [];
  const plan: SessionPlan = structuredClone(raw);
  plan.sessionType = sessionType;
  for (const b of plan.blocks) {
    const before = b.exercises.length;
    b.exercises = b.exercises.filter((e) => {
      const bad = disliked.has(lc(e.name));
      if (bad) dropped.push(e.name);
      return !bad;
    });
    if (before > 0 && b.exercises.length === 0) emptied.push(b.block);
  }
  if (sessionType !== "reentry") {
    for (const b of plan.blocks) for (const e of b.exercises) {
      const d = decisionFor(ctx, e.name);
      if (!d || d.nextWeight === null || e.unit === "bodyweight" || e.unit === "time" || e.unit === "distance" || e.unit === "cardio") continue;
      for (const s of e.sets) if (s.setType === "working") s.weight = d.nextWeight;
    }
  }
  const recompute = () => {
    const d = estimateDuration(plan);
    for (const b of plan.blocks) b.estimatedMinutes = d.byBlock[b.block] ?? 0;
    plan.estimatedMinutes = d.total;
  };
  recompute();
  if (plan.estimatedMinutes > minutesAvailable) {
    const strength = plan.blocks.find((b) => b.block === "strength");
    const primary = strength?.exercises.slice(0, PRIMARY_LIFTS) ?? [];
    const candidates = plan.blocks.flatMap((b) => b.exercises).filter((e) => !primary.includes(e)).reverse();
    for (const e of candidates) {
      while (plan.estimatedMinutes > minutesAvailable && e.sets.some((s) => s.setType === "ramp")) {
        e.sets.splice(e.sets.findIndex((s) => s.setType === "ramp"), 1);
        recompute();
      }
    }
  }
  return { plan, emptied, dropped };
}

/** Run the model; if dropping disliked exercises empties a block, re-ask once naming the offenders. */
async function generate(
  ctx: CoachContext, sessionType: SessionType, minutes: number, prompt: { system: string; user: string },
): Promise<SessionPlan> {
  let user = prompt.user;
  for (let attempt = 0; ; attempt++) {
    const out = await callStructured({ model: MODELS.routine, system: prompt.system, user, schema: SessionPlan });
    const fin = finalizePlan(ctx, out, sessionType, minutes);
    if (fin.emptied.length === 0 || attempt > 0) return fin.plan;
    user = `${prompt.user}

${dislikedNote(fin)}`;
  }
}

const dislikedNote = (f: { dropped: string[]; emptied: string[] }) =>
  `Your previous answer used exercises the client dislikes (${f.dropped.join(", ")}), which left the ${f.emptied.join(", ")} block empty. Replace them with other suitable exercises.`;

async function writeRows(sessionId: string, plan: SessionPlan) {
  let orderIndex = 0;
  for (const b of plan.blocks) for (const e of b.exercises) {
    const working = e.sets.filter((s) => s.setType === "working");
    await db.sessionExercise.create({
      data: {
        sessionId, name: e.name, muscleGroups: e.muscleGroups.join(","), block: b.block, pairGroup: e.pairGroup,
        unit: e.unit, restSec: e.restSec, cue: e.cue, prescription: JSON.stringify(e.sets),
        targetSets: working.length, targetReps: working[0]?.reps != null ? String(working[0].reps) : "",
        targetWeight: working[0]?.weight ?? null, aiNotes: e.whyTarget, orderIndex: orderIndex++,
      },
    });
  }
}

export async function planSession(
  clientId: string, opts: { date: string; checkInId?: string; sessionTypeOverride?: string },
): Promise<{ sessionId: string; plan: SessionPlan }> {
  const ctx = await buildContext(clientId, opts.date, opts.checkInId);
  const structure = ctx.program?.structure;
  const rotation = structure?.rotation ?? DEFAULT_ROTATION;
  const sel = selectSessionType({
    history: ctx.history, today: opts.date, rotation, minHoursBetweenHeavy: structure?.minHoursBetweenHeavy ?? 48,
    layoffDays: ctx.client.layoffDays, readiness: ctx.readiness,
  });
  const sessionType = opts.sessionTypeOverride ? SessionType.parse(opts.sessionTypeOverride) : sel.sessionType;
  const reasons = opts.sessionTypeOverride ? [`The client asked for ${sessionType}.`, ...sel.reasons] : sel.reasons;
  const carryOver = carryOverSkips(ctx.history.at(-1) ?? null);
  const poolRaw = [...(structure?.sessionTypes[sessionType]?.exercisePool ?? []), ...carryOver.map((c) => c.name)];
  const { exercises: pool, changes } = applyPreferences([...new Set(poolRaw)], ctx.preferences as PreferenceRow[]);
  const facts: PlanFacts = {
    sessionType, reasons, layoff: detectLayoff(ctx.history, opts.date, ctx.client.layoffDays),
    targets: pool.map((n) => decisionFor(ctx, n)).filter((d): d is WeightDecision => d !== null),
    pool, preferenceChanges: changes, carryOver, emphasisShifts: emphasisShifts(ctx.readiness),
    recentMuscles: musclesTrainedRecently(ctx.history, opts.date, 48),
    minutesAvailable: ctx.checkIn?.minutesAvailable ?? ctx.client.defaultMinutes, hardCapMinutes: ctx.client.hardCapMinutes,
  };
  const minutes = Math.min(facts.minutesAvailable, ctx.client.hardCapMinutes);
  const plan = await generate(ctx, sessionType, minutes, buildPlanPrompt(ctx, facts));
  // A regenerated plan for the same day replaces the earlier unstarted one.
  await db.workoutSession.deleteMany({ where: { clientId, date: opts.date, phase: "planned" } });
  const s = await db.workoutSession.create({
    data: {
      clientId, programVersionId: ctx.program?.id ?? null, date: opts.date, template: sessionType, sessionType, phase: "planned",
      name: plan.name, coachNotes: plan.coachNotes, estimatedMinutes: plan.estimatedMinutes, plan: JSON.stringify(plan),
    },
  });
  await writeRows(s.id, plan);
  if (opts.checkInId) await db.checkIn.updateMany({ where: { id: opts.checkInId, clientId }, data: { sessionId: s.id } });
  return { sessionId: s.id, plan };
}

export async function refinePlan(
  clientId: string, sessionId: string, message: string,
): Promise<{ plan: SessionPlan; reply: string; savedPreferenceIds: string[] }> {
  const session = await db.workoutSession.findFirst({ where: { id: sessionId, clientId } });
  if (!session || !session.plan) throw new Error("Planned session not found");
  if (session.phase !== "planned") throw new Error("Only a planned session can be refined");
  const current = SessionPlan.parse(JSON.parse(session.plan));
  const ctx = await buildContext(clientId, session.date);
  const targets = current.blocks.flatMap((b) => b.exercises)
    .map((e) => decisionFor(ctx, e.name)).filter((d): d is WeightDecision => d !== null);
  const minutes = Math.min(ctx.client.defaultMinutes, ctx.client.hardCapMinutes);
  const sessionType = current.sessionType;
  const first = await callStructured({ model: MODELS.routine, ...buildRefinePrompt(ctx, current, message, targets), schema: RefineOut });

  const savedPreferenceIds: string[] = [];
  for (const p of first.savedPreferences) {
    const row = await db.exercisePreference.upsert({
      where: { clientId_exerciseName_kind: { clientId, exerciseName: p.exerciseName, kind: p.kind } },
      create: { clientId, exerciseName: p.exerciseName, kind: p.kind, substituteFor: p.kind === "substitute" ? p.substituteFor : null },
      update: { substituteFor: p.kind === "substitute" ? p.substituteFor : null },
    });
    savedPreferenceIds.push(row.id);
  }
  if (savedPreferenceIds.length) ctx.preferences = await db.exercisePreference.findMany({ where: { clientId } });

  let fin = finalizePlan(ctx, first.plan, sessionType, minutes);
  let reply = first.reply;
  if (fin.emptied.length) {
    const p = buildRefinePrompt(ctx, current, message, targets);
    const again = await callStructured({
      model: MODELS.routine, system: p.system, schema: RefineOut,
      user: `${p.user}\n\nYour previous answer used exercises the client dislikes (${fin.dropped.join(", ")}), which left the ${fin.emptied.join(", ")} block empty. Replace them with other suitable exercises.`,
    });
    fin = finalizePlan(ctx, again.plan, sessionType, minutes);
    reply = again.reply;
  }
  const plan = fin.plan;
  await db.sessionExercise.deleteMany({ where: { sessionId } });
  await db.workoutSession.update({
    where: { id: sessionId },
    data: { name: plan.name, coachNotes: plan.coachNotes, estimatedMinutes: plan.estimatedMinutes, plan: JSON.stringify(plan) },
  });
  await writeRows(sessionId, plan);
  return { plan, reply, savedPreferenceIds };
}
