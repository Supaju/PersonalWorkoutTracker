import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, ownedSession, ownedExercise, notFound, reReview } from "@/lib/api-util";

const Body = z.object({
  machine: z.string().min(1),
  minutes: z.number().positive(),
  settings: z.union([z.string(), z.record(z.string(), z.unknown())]).nullish(),
  intervals: z.string().nullish(),
  perceivedEffort: z.number().int().min(1).max(10).nullish(),
  talkTest: z.enum(["full_sentences", "short_phrases", "few_words"]).nullish(),
  heartRate: z.number().int().nullish(),
  distanceMi: z.number().nullish(),
  calories: z.number().int().nullish(),
  notes: z.string().nullish(),
});

/** One CardioLog per exercise: update the existing row or create it. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string; exId: string }> }) {
  const clientId = await getClientId();
  const { id, exId } = await params;
  const p = await parseBody(req, Body);
  if ("res" in p) return p.res;
  const session = await ownedSession(clientId, id);
  if (!session || !(await ownedExercise(clientId, id, exId))) return notFound();
  const d = p.data;
  const data = {
    machine: d.machine, minutes: d.minutes,
    settings: d.settings == null ? null : typeof d.settings === "string" ? d.settings : JSON.stringify(d.settings),
    intervals: d.intervals ?? null, perceivedEffort: d.perceivedEffort ?? null, talkTest: d.talkTest ?? null,
    heartRate: d.heartRate ?? null, distanceMi: d.distanceMi ?? null, calories: d.calories ?? null, notes: d.notes ?? null,
  };
  const prev = await db.cardioLog.findFirst({ where: { exerciseId: exId } });
  const cardio = prev
    ? await db.cardioLog.update({ where: { id: prev.id }, data })
    : await db.cardioLog.create({ data: { exerciseId: exId, ...data } });
  return NextResponse.json({ cardio, ...reReview(session) });
}
