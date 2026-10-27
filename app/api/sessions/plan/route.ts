import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, notFound, withAI } from "@/lib/api-util";
import { planSession } from "@/lib/coach/engine";

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkInId: z.string().optional(),
  sessionTypeOverride: z.string().optional(),
});

export async function POST(req: Request) {
  const clientId = await getClientId();
  const p = await parseBody(req, Body);
  if ("res" in p) return p.res;
  if (p.data.checkInId && !(await db.checkIn.findFirst({ where: { id: p.data.checkInId, clientId }, select: { id: true } }))) return notFound();
  return withAI(async () => NextResponse.json(await planSession(clientId, p.data)));
}
