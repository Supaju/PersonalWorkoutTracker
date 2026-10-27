import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, ownedSession, notFound } from "@/lib/api-util";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const clientId = await getClientId();
  const { id } = await params;
  const session = await db.workoutSession.findFirst({
    where: { id, clientId },
    include: {
      exercises: {
        include: { sets: { orderBy: { setNumber: "asc" } }, cardio: true, feedback: true },
        orderBy: { orderIndex: "asc" },
      },
      questions: true,
      checkIns: true,
    },
  });
  return session ? NextResponse.json(session) : notFound();
}

const Patch = z.object({
  phase: z.enum(["planned", "active", "recorded"]).optional(),
  startedAt: z.string().datetime({ offset: true }).optional(),
  finishedAt: z.string().datetime({ offset: true }).optional(),
  durationMin: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const clientId = await getClientId();
  const { id } = await params;
  const p = await parseBody(req, Patch);
  if ("res" in p) return p.res;
  const cur = await ownedSession(clientId, id);
  if (!cur) return notFound();
  const { startedAt, finishedAt, ...rest } = p.data;
  const data: Record<string, unknown> = { ...rest };
  if (startedAt) data.startedAt = new Date(startedAt);
  if (finishedAt) data.finishedAt = new Date(finishedAt);
  if (rest.phase === "active" && !cur.startedAt && !startedAt) data.startedAt = new Date();
  if (rest.phase === "recorded") {
    const fin = (data.finishedAt as Date | undefined) ?? cur.finishedAt ?? new Date();
    data.finishedAt = fin;
    const start = (data.startedAt as Date | undefined) ?? cur.startedAt;
    if (!cur.durationMin && !rest.durationMin && start) data.durationMin = Math.max(1, Math.round((+fin - +start) / 60000));
  }
  const updated = await db.workoutSession.update({ where: { id }, data });
  return NextResponse.json({ ...updated, ...(cur.reviewedAt && (rest.notes !== undefined || rest.durationMin) ? { needsReReview: true } : {}) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const clientId = await getClientId();
  const { id } = await params;
  const { count } = await db.workoutSession.deleteMany({ where: { id, clientId } });
  return count ? NextResponse.json({ ok: true }) : notFound();
}
