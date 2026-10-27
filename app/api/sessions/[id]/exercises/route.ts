import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, ownedSession, notFound, reReview } from "@/lib/api-util";
import { Block, LoadUnit } from "@/lib/coach/schemas";

const Body = z.object({
  id: z.string().min(1).optional(), // client-generated; makes retries idempotent
  name: z.string().min(1),
  muscleGroups: z.array(z.string()).default([]),
  unit: LoadUnit.default("total"),
  block: Block.default("strength"),
});

/** Add an unplanned exercise (flagged added=true), appended after the last one. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId();
  const { id } = await params;
  const p = await parseBody(req, Body);
  if ("res" in p) return p.res;
  const session = await ownedSession(clientId, id);
  if (!session) return notFound();
  if (p.data.id) {
    const existing = await db.sessionExercise.findUnique({ where: { id: p.data.id } });
    if (existing) return existing.sessionId === id ? NextResponse.json({ exercise: existing, ...reReview(session) }) : notFound();
  }
  const last = await db.sessionExercise.aggregate({ where: { sessionId: id }, _max: { orderIndex: true } });
  const ex = await db.sessionExercise.create({
    data: {
      ...(p.data.id ? { id: p.data.id } : {}), sessionId: id, name: p.data.name, muscleGroups: p.data.muscleGroups.join(", "), unit: p.data.unit,
      block: p.data.block, added: true, orderIndex: (last._max.orderIndex ?? -1) + 1,
    },
  });
  return NextResponse.json({ exercise: ex, ...reReview(session) });
}
