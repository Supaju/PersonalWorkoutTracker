// "Today" / week computation shared by GET /api/today, GET /api/week and the conversation context.
import { db } from "@/lib/db";
import { detectLayoff, selectSessionType, weekView, type LoggedSession, type ReadinessInput } from "./rules";
import { toLoggedSession, toBodyAreas } from "./mappers";
import { ProgramStructure, type CheckInInput, type SessionType } from "./schemas";

export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDate(d);
};

const DEFAULT_ROTATION: SessionType[] = ["heavy_fullbody", "light_conditioning"];

export async function loadHistory(clientId: string): Promise<LoggedSession[]> {
  const rows = await db.workoutSession.findMany({
    where: { clientId, phase: "recorded" },
    include: { exercises: { include: { sets: true } } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toLoggedSession);
}

export async function loadSchedule(clientId: string) {
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  const version = await db.programVersion.findFirst({ where: { clientId, endDate: null }, orderBy: { version: "desc" } });
  let structure: ProgramStructure | null = null;
  try { structure = version ? ProgramStructure.parse(JSON.parse(version.structure)) : null; } catch { /* use defaults */ }
  return {
    client,
    trainingDays: JSON.parse(client.trainingDays) as number[],
    rotation: structure?.rotation.length ? structure.rotation : DEFAULT_ROTATION,
    minHoursBetweenHeavy: structure?.minHoursBetweenHeavy ?? 48,
    layoffDays: client.layoffDays,
  };
}

export async function createCheckIn(clientId: string, input: CheckInInput, id?: string) {
  return db.checkIn.create({
    data: {
      ...(id ? { id } : {}), clientId, kind: input.kind, date: input.date, sessionId: input.sessionId ?? null,
      soreness: input.soreness ? JSON.stringify(input.soreness) : null,
      sleep: input.sleep ?? null, energy: input.energy ?? null, minutesAvailable: input.minutesAvailable ?? null,
      painNotes: input.painNotes ?? null, effort: input.effort ?? null, enjoyment: input.enjoyment ?? null,
      conditioning: input.conditioning ?? null, bodyweightLbs: input.bodyweightLbs ?? null, note: input.note ?? null,
    },
  });
}

export async function getToday(clientId: string, today = localDate()) {
  const [sch, history] = await Promise.all([loadSchedule(clientId), loadHistory(clientId)]);

  const pre = await db.checkIn.findFirst({ where: { clientId, kind: "pre", date: today }, orderBy: { createdAt: "desc" } });
  const readiness: ReadinessInput | null = pre
    ? {
        sleep: pre.sleep as ReadinessInput["sleep"], energy: pre.energy as ReadinessInput["energy"],
        soreness: pre.soreness ? JSON.parse(pre.soreness) : {}, minutesAvailable: pre.minutesAvailable,
      }
    : null;

  const sel = selectSessionType({
    history, today, rotation: sch.rotation, minHoursBetweenHeavy: sch.minHoursBetweenHeavy,
    layoffDays: sch.layoffDays, readiness,
  });

  const brief = { select: { id: true, date: true, sessionType: true, name: true } } as const;
  const [activeSession, plannedSession, lastRecorded, pendingQuestions, pendingProposals] = await Promise.all([
    db.workoutSession.findFirst({ where: { clientId, phase: "active" }, orderBy: { date: "desc" }, ...brief }),
    db.workoutSession.findFirst({ where: { clientId, phase: "planned", date: today }, orderBy: { createdAt: "desc" }, ...brief }),
    db.workoutSession.findFirst({ where: { clientId, phase: "recorded" }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { exercises: true } }),
    db.clarifyingQuestion.findMany({ where: { answer: null, session: { clientId } }, orderBy: { createdAt: "asc" } }),
    db.programProposal.findMany({ where: { clientId, status: "pending" }, orderBy: { createdAt: "desc" }, select: { id: true, recommendation: true, createdAt: true } }),
  ]);

  let summary: string | null = null;
  try { summary = lastRecorded?.coachReview ? JSON.parse(lastRecorded.coachReview).summary ?? null : null; } catch { /* ignore */ }

  let needsNextDayCheck: { areas: string[] } | null = null;
  if (lastRecorded && lastRecorded.date === addDays(today, -1)) {
    const done = await db.checkIn.findFirst({ where: { clientId, kind: "next_day", sessionId: lastRecorded.id } });
    if (!done) needsNextDayCheck = { areas: toBodyAreas(lastRecorded.exercises.flatMap((e) => e.muscleGroups.split(","))) };
  }

  return {
    date: today,
    isTrainingDay: sch.trainingDays.includes(new Date(`${today}T12:00:00`).getDay()),
    suggestedSessionType: sel.sessionType,
    reasons: sel.reasons,
    layoff: detectLayoff(history, today, sch.layoffDays),
    activeSession, plannedSession,
    lastSession: lastRecorded ? { id: lastRecorded.id, date: lastRecorded.date, sessionType: lastRecorded.sessionType, summary } : null,
    pendingQuestions, pendingProposals, needsNextDayCheck,
  };
}

export async function getWeek(clientId: string, today = localDate()) {
  const [sch, history] = await Promise.all([loadSchedule(clientId), loadHistory(clientId)]);
  return weekView({
    history, today, trainingDays: sch.trainingDays, rotation: sch.rotation,
    minHoursBetweenHeavy: sch.minHoursBetweenHeavy, layoffDays: sch.layoffDays,
  });
}
