import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, ownedSession, ownedExercise, notFound, reReview } from "@/lib/api-util";
import { SkipReason } from "@/lib/coach/schemas";

const Patch = z.object({
  skipped: z.boolean().optional(),
  skipReason: SkipReason.nullish(),
  name: z.string().min(1).optional(),
  swappedFrom: z.string().nullish(),
  orderIndex: z.number().int().min(0).optional(),
});

/** Skip {skipped, skipReason}, swap {name, swappedFrom}, reorder {orderIndex}. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; exId: string }> }) {
  const clientId = await getClientId();
  const { id, exId } = await params;
  const p = await parseBody(req, Patch);
  if ("res" in p) return p.res;
  const session = await ownedSession(clientId, id);
  if (!session || !(await ownedExercise(clientId, id, exId))) return notFound();
  const d = p.data;
  const ex = await db.sessionExercise.update({
    where: { id: exId },
    data: {
      ...(d.skipped !== undefined && { skipped: d.skipped, skipReason: d.skipped ? d.skipReason ?? null : null }),
      ...(d.name && { name: d.name, swappedFrom: d.swappedFrom ?? null }),
      ...(d.orderIndex !== undefined && { orderIndex: d.orderIndex }),
    },
  });
  return NextResponse.json({ exercise: ex, ...reReview(session) });
}
