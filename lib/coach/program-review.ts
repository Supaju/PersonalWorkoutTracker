// Program evolution. Deterministic trigger detection (unit-tested) + model-written proposals.
// CONTRACT: signatures fixed. Workstream C implements.
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { db } from "@/lib/db";
import { getAnthropic } from "./anthropic";
import { TEMPLATES } from "@/lib/templates";
import type { LoggedSession } from "./rules";
import { MODELS, PHILOSOPHY, PROGRAM_REVIEW, DEFAULT_PERSONA } from "./philosophy";
import { ProposalOut, type TriggerKind, type ProgramStructure } from "./schemas";

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

// ─── Local date helpers (rules.ts bodies belong to another workstream) ───────

const DAY = 86400000;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => iso(ms(d) + n * DAY);
const daysApart = (a: string, b: string) => Math.round((ms(b) - ms(a)) / DAY);
/** Monday of the week containing d. */
const mondayOf = (d: string) => addDays(d, -((new Date(ms(d)).getUTCDay() + 6) % 7));

const HEAVY_LIGHT = "heavy_light_fullbody";
// Most urgent first; the first one present is the fingerprint's primary trigger.
const PRIORITY: TriggerKind[] = [
  "setback", "ready_to_progress", "poor_fit", "stalled_lifts", "bodyweight_change",
  "schedule_or_goal_change", "client_request", "new_consideration", "scheduled",
];

/** Multi-week trends from logs. Pure. */
export function computeTrends(input: TrendInput): Trends {
  const sessions = input.history.filter((s) => s.phase === "recorded" && s.date <= input.today);
  const planned = input.trainingDays.length;
  const completedIn = (weekStart: string) =>
    sessions.filter((s) => s.date >= weekStart && s.date < addDays(weekStart, 7)).length;

  const lastFullWeek = addDays(mondayOf(input.today), -7);
  const win = PROGRAM_REVIEW.adherenceWindowWeeks;
  const adherence = Array.from({ length: win }, (_, i) => {
    const weekStart = addDays(lastFullWeek, -7 * (win - 1 - i));
    return { weekStart, planned, completed: completedIn(weekStart) };
  });
  const totalPlanned = adherence.reduce((a, w) => a + w.planned, 0);
  const adherenceRate = totalPlanned
    ? adherence.reduce((a, w) => a + Math.min(w.completed, w.planned), 0) / totalPlanned
    : 0;

  // Trailing consistent weeks; never counts weeks before the first logged session.
  const first = sessions[0]?.date;
  let consecutiveConsistentWeeks = 0;
  for (let w = lastFullWeek; first && addDays(w, 6) >= first && completedIn(w) >= planned; w = addDays(w, -7)) {
    consecutiveConsistentWeeks++;
  }

  // Stalled: the last N exposures of a weighted lift all used the same top working weight.
  const byLift = new Map<string, number[]>();
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (e.skipped || ["bodyweight", "time", "distance", "cardio"].includes(e.unit)) continue;
      const ws = e.sets.filter((x) => x.setType === "working" && x.weight != null).map((x) => x.weight as number);
      if (ws.length) byLift.set(e.name, [...(byLift.get(e.name) ?? []), Math.max(...ws)]);
    }
  }
  const stalledLifts: Trends["stalledLifts"] = [];
  for (const [name, ws] of byLift) {
    const w = ws[ws.length - 1];
    let n = 0;
    for (let i = ws.length - 1; i >= 0 && ws[i] === w; i--) n++;
    if (n >= PROGRAM_REVIEW.stallExposures) stalledLifts.push({ name, weight: w, exposures: n });
  }

  const winStart = addDays(input.today, -7 * win);
  const timeSkips = sessions
    .filter((s) => s.date > winStart)
    .reduce((a, s) => a + s.exercises.filter((e) => e.skipped && e.skipReason === "time").length, 0);

  const bw = input.bodyweights
    .filter((b) => b.date > winStart && b.date <= input.today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const bodyweightChangePct = bw.length >= 2 ? (bw[bw.length - 1].lbs - bw[0].lbs) / bw[0].lbs : null;

  const last = sessions[sessions.length - 1];
  return {
    adherence, adherenceRate, consecutiveConsistentWeeks, stalledLifts, timeSkips, bodyweightChangePct,
    daysSinceLastSession: last ? daysApart(last.date, input.today) : null,
  };
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
  const t = new Set<TriggerKind>();
  const since = input.lastReviewDate && input.lastReviewDate > input.versionStartDate
    ? input.lastReviewDate : input.versionStartDate;
  if (daysApart(since, input.today) >= input.reviewEveryWeeks * 7) t.add("scheduled");
  if (
    input.currentPhase === HEAVY_LIGHT &&
    trends.consecutiveConsistentWeeks >= 4 &&
    trends.adherenceRate >= PROGRAM_REVIEW.readyToProgressAdherence
  ) t.add("ready_to_progress");
  if (trends.stalledLifts.length) t.add("stalled_lifts");
  const since0 = trends.daysSinceLastSession;
  const layoff = since0 !== null && since0 >= PROGRAM_REVIEW.setbackDays;
  // A layoff is not a poor fit: it is handled by setback / re-entry.
  if ((since0 !== null && !layoff && trends.adherenceRate < PROGRAM_REVIEW.poorFitAdherence) ||
      trends.timeSkips >= PROGRAM_REVIEW.poorFitTimeSkips) t.add("poor_fit");
  if (trends.bodyweightChangePct !== null && Math.abs(trends.bodyweightChangePct) >= PROGRAM_REVIEW.bodyweightChangePct) {
    t.add("bodyweight_change");
  }
  if (input.considerationsAddedSince > 0) t.add("new_consideration");
  if (input.scheduleOrGoalChangedSince) t.add("schedule_or_goal_change");
  if (input.clientRequested) t.add("client_request");
  if (layoff && input.currentPhase !== HEAVY_LIGHT) t.add("setback");
  return PRIORITY.filter((k) => t.has(k));
}

/** Phase the coach should propose for the given triggers (setback → heavy_light_fullbody; ready_to_progress from heavy/light → upper_lower_4day). Null = let the model decide. */
export function targetPhase(currentPhase: string, triggers: TriggerKind[]): string | null {
  if (triggers.includes("setback")) return HEAVY_LIGHT;
  if (triggers.includes("ready_to_progress") && currentPhase === HEAVY_LIGHT) return "upper_lower_4day";
  return null;
}

export function proposalFingerprint(proposedPhase: string, triggers: TriggerKind[]): string {
  return `${proposedPhase}|${PRIORITY.find((k) => triggers.includes(k)) ?? "scheduled"}`;
}

/**
 * True if a proposal with this fingerprint was rejected and there is no new evidence:
 * rejected within PROGRAM_REVIEW.rejectionCooldownWeeks, and triggers contain nothing beyond the rejected
 * proposal's own primary trigger + "scheduled".
 */
export function isSuppressed(fingerprint: string, triggers: TriggerKind[], input: TrendInput): boolean {
  const recent = input.rejected.some(
    (r) => r.fingerprint === fingerprint &&
      daysApart(r.decidedAt, input.today) < PROGRAM_REVIEW.rejectionCooldownWeeks * 7,
  );
  if (!recent) return false;
  const own = fingerprint.split("|")[1];
  return triggers.every((k) => k === own || k === "scheduled");
}

// ─── DB-backed review ────────────────────────────────────────────────────────

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const parseJson = <T,>(s: string, fallback: T): T => { try { return JSON.parse(s) as T; } catch { return fallback; } };

async function loadInput(clientId: string, today: string, clientRequested: boolean) {
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId }, include: { profile: true } });
  const version = await db.programVersion.findFirst({ where: { clientId, endDate: null }, orderBy: { version: "desc" } });
  if (!version) throw new Error("Client has no current program version");
  const [sessions, checkIns, proposals, considerations] = await Promise.all([
    db.workoutSession.findMany({
      where: { clientId, phase: "recorded" }, orderBy: { date: "asc" },
      include: { exercises: { orderBy: { orderIndex: "asc" }, include: { sets: true } } },
    }),
    db.checkIn.findMany({ where: { clientId, bodyweightLbs: { not: null } }, orderBy: { date: "asc" } }),
    db.programProposal.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }),
    db.clientConsideration.findMany({ where: { clientId, active: true } }),
  ]);
  const history: LoggedSession[] = sessions.map((s) => ({
    date: s.date, sessionType: s.sessionType, phase: "recorded",
    exercises: s.exercises.map((e) => ({
      name: e.name, unit: e.unit as never, muscleGroups: e.muscleGroups.split(",").filter(Boolean),
      targetReps: parseInt(e.targetReps) || null, skipped: e.skipped, skipReason: e.skipReason as never,
      sets: e.sets.map((x) => ({
        setType: x.setType as never, weight: x.weightLbs, reps: x.reps, rir: x.rir,
        durationSec: x.durationSec, distanceYd: x.distanceYd,
      })),
    })),
  }));
  const lastReview = proposals.length ? proposals[proposals.length - 1].createdAt : null;
  const sinceCutoff = lastReview ?? new Date(ms(version.startDate));
  const input: TrendInput = {
    today, history, trainingDays: parseJson<number[]>(client.trainingDays, [1, 2, 4, 5]),
    currentPhase: version.phase, versionStartDate: version.startDate,
    lastReviewDate: lastReview ? ymd(lastReview) : null,
    reviewEveryWeeks: client.reviewEveryWeeks,
    bodyweights: checkIns.map((c) => ({ date: c.date, lbs: c.bodyweightLbs as number })),
    considerationsAddedSince: considerations.filter((c) => c.createdAt > sinceCutoff).length,
    // ponytail: schedule/goal edits aren't timestamped yet; stays false until Client gets an updatedAt.
    scheduleOrGoalChangedSince: false,
    clientRequested,
    rejected: proposals
      .filter((p) => p.status === "rejected" && p.decidedAt)
      .map((p) => ({ fingerprint: p.fingerprint, decidedAt: ymd(p.decidedAt as Date) })),
  };
  return { client, version, input, considerations, proposals };
}

/**
 * Full review for a client: load data, compute trends + triggers, ask the deep model for a ProposalOut,
 * store a pending ProgramProposal. Never changes the current ProgramVersion.
 * ponytail: no web research inside the review yet; add by calling runResearch and filling researchNoteIds.
 */
export async function runProgramReview(
  clientId: string, opts: { today: string; clientRequested?: boolean },
): Promise<{ proposalId: string } | { proposalId: null; reason: string }> {
  const { client, version, input, considerations, proposals } = await loadInput(clientId, opts.today, !!opts.clientRequested);
  if (proposals.some((p) => p.status === "pending")) {
    return { proposalId: null, reason: "A proposal is already waiting for a decision." };
  }

  const trends = computeTrends(input);
  const triggers = detectTriggers(input, trends);
  if (!triggers.length) return { proposalId: null, reason: "No review trigger has fired." };
  const target = targetPhase(input.currentPhase, triggers);
  const fingerprint = proposalFingerprint(target ?? input.currentPhase, triggers);
  if (isSuppressed(fingerprint, triggers, input)) {
    return { proposalId: null, reason: "A similar proposal was declined recently and nothing new has come up." };
  }

  const prompt = {
    client: {
      name: client.name, goals: client.profile?.goals, goalNotes: client.profile?.goalNotes,
      weightLbs: client.profile?.weightLbs,
    },
    considerations: considerations.map((c) => c.text),
    currentProgram: { phase: version.phase, since: version.startDate, structure: parseJson(version.structure, null) },
    today: opts.today, triggers, targetPhase: target, trends,
    pastProposals: proposals.slice(-5).map((p) => ({ fingerprint: p.fingerprint, status: p.status, response: p.clientResponse })),
    upperLowerTemplates: Object.values(TEMPLATES).map((t) => ({
      session: t.id, label: t.label,
      slots: t.slots.map((s) => ({ label: s.label, sets: s.sets, reps: s.targetReps, fixed: s.fixed, examples: s.examples })),
    })),
  };
  const system = [
    client.persona || DEFAULT_PERSONA,
    "You are the coach writing a program-review proposal for the client to accept or decline. You never change the program yourself.",
    "Observations must each cite numbers from the trends given. Use only the data provided; do not invent numbers.",
    "If targetPhase is set, propose exactly that phase (structure.phase must equal it). If upper_lower_4day, base each session type's exercisePool on upperLowerTemplates. Rotation uses session types heavy_fullbody, light_conditioning, upper_a, lower_a, upper_b, lower_b.",
    "Explain trade-offs honestly, including what the client gives up. Say what changes week to week.",
    ...PHILOSOPHY.weekly, ...PHILOSOPHY.load, ...PHILOSOPHY.safety,
  ].join("\n");

  const res = await getAnthropic().messages.parse({
    model: MODELS.deep, max_tokens: 8000, system,
    messages: [{ role: "user", content: JSON.stringify(prompt) }],
    output_config: { format: zodOutputFormat(ProposalOut) },
  });
  const out = ProposalOut.parse(res.parsed_output);

  const row = await db.programProposal.create({
    data: {
      clientId, trigger: JSON.stringify(triggers), fingerprint,
      observations: JSON.stringify(out.observations), recommendation: out.recommendation,
      rationale: out.rationale, tradeOffs: out.tradeOffs, weekToWeek: out.weekToWeek,
      structure: JSON.stringify(out.structure),
    },
  });
  return { proposalId: row.id };
}

/** Accept → close current version (endDate) and create version+1 from the proposal structure; mark accepted. Reject → mark rejected with response. */
export async function decideProposal(
  clientId: string, proposalId: string, decision: "accept" | "reject", response?: string,
): Promise<{ versionId: string | null }> {
  const p = await db.programProposal.findFirst({ where: { id: proposalId, clientId } });
  if (!p) throw new Error("Proposal not found");
  if (p.status !== "pending") throw new Error(`Proposal already ${p.status}`);
  const decidedAt = new Date();
  if (decision === "reject") {
    await db.programProposal.update({ where: { id: p.id }, data: { status: "rejected", clientResponse: response ?? null, decidedAt } });
    return { versionId: null };
  }
  const structure = ProposalOut.shape.structure.parse(JSON.parse(p.structure));
  const today = ymd(decidedAt);
  const versionId = await db.$transaction(async (tx) => {
    const cur = await tx.programVersion.findFirst({ where: { clientId, endDate: null }, orderBy: { version: "desc" } });
    if (cur) await tx.programVersion.update({ where: { id: cur.id }, data: { endDate: today } });
    const v = await tx.programVersion.create({
      data: {
        clientId, version: (cur?.version ?? 0) + 1, phase: structure.phase, structure: p.structure,
        reason: p.recommendation, startDate: today, proposalId: p.id,
      },
    });
    await tx.programProposal.update({ where: { id: p.id }, data: { status: "accepted", clientResponse: response ?? null, decidedAt } });
    return v.id;
  });
  return { versionId };
}

export type { ProgramStructure };
