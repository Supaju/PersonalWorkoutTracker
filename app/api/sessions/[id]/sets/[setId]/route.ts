import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, ownedSession, ownedExercise, notFound, reReview } from "@/lib/api-util";
import { SetType } from "@/lib/coach/schemas";

type Ctx = { params: Promise<{ id: string; setId: string }> };

const Body = z.object({
  exerciseId: z.string(),
  setNumber: z.number().int().positive(),
  setType: SetType.default("working"),
  weightLbs: z.number().nullish(),
  reps: z.number().int().nullish(),
  rir: z.number().int().min(0).max(4).nullish(),
  durationSec: z.number().int().nullish(),
  distanceYd: z.number().nullish(),
  notes: z.string().nullish(),
});

/** Idempotent upsert keyed by the client-generated setId (safe for offline retry). */
export async function PUT(req: Request, { params }: Ctx) {
  const clientId = await getClientId();
  const { id, setId } = await params;
  const p = await parseBody(req, Body);
  if ("res" in p) return p.res;
  const session = await ownedSession(clientId, id);
  if (!session || !(await ownedExercise(clientId, id, p.data.exerciseId))) return notFound();
  // An id that already exists must belong to this session, else it is someone else's row.
  const existing = await db.setLog.findUnique({ where: { id: setId }, select: { exercise: { select: { sessionId: true } } } });
  if (existing && existing.exercise.sessionId !== id) return notFound();

  const { exerciseId, ...fields } = p.data;
  const data = {
    ...fields, weightLbs: fields.weightLbs ?? null, reps: fields.reps ?? null, rir: fields.rir ?? null,
    durationSec: fields.durationSec ?? null, distanceYd: fields.distanceYd ?? null, notes: fields.notes ?? null,
  };
  const set = await db.setLog.upsert({
    where: { id: setId }, create: { id: setId, exerciseId, ...data }, update: { exerciseId, ...data },
  });
  if (session.phase === "planned") {
    await db.workoutSession.update({ where: { id }, data: { phase: "active", startedAt: session.startedAt ?? new Date() } });
  }
  return NextResponse.json({ set, ...reReview(session) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const clientId = await getClientId();
  const { id, setId } = await params;
  const session = await ownedSession(clientId, id);
  if (!session) return notFound();
  const { count } = await db.setLog.deleteMany({ where: { id: setId, exercise: { sessionId: id } } });
  return count ? NextResponse.json({ ok: true, ...reReview(session) }) : notFound();
}
