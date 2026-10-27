import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, ownedSession, notFound } from "@/lib/api-util";
import { CheckInInput } from "@/lib/coach/schemas";
import { createCheckIn } from "@/lib/coach/today";

// Optional client-generated id makes retries after a lost response safe.
const Body = CheckInInput.extend({ id: z.string().min(1).optional() });

export async function POST(req: Request) {
  const clientId = await getClientId();
  const p = await parseBody(req, Body);
  if ("res" in p) return p.res;
  if (p.data.sessionId && !(await ownedSession(clientId, p.data.sessionId))) return notFound();
  if (p.data.id) {
    const existing = await db.checkIn.findUnique({ where: { id: p.data.id }, select: { id: true, clientId: true } });
    if (existing) return existing.clientId === clientId ? NextResponse.json({ id: existing.id }) : notFound();
  }
  const row = await createCheckIn(clientId, p.data, p.data.id);
  return NextResponse.json({ id: row.id });
}
