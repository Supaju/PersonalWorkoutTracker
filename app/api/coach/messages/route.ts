import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, ownedSession, notFound } from "@/lib/api-util";
import { handleMessage } from "@/lib/coach/conversation";

/** GET ?limit=50 → oldest-first slice of the most recent messages. */
export async function GET(req: Request) {
  const clientId = await getClientId();
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 50, 200);
  const rows = await db.coachMessage.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: limit });
  return NextResponse.json(rows.reverse());
}

export async function POST(req: Request) {
  const clientId = await getClientId();
  const p = await parseBody(req, z.object({ text: z.string().min(1), sessionId: z.string().optional() }));
  if ("res" in p) return p.res;
  if (p.data.sessionId && !(await ownedSession(clientId, p.data.sessionId))) return notFound();
  return NextResponse.json(await handleMessage(clientId, p.data.text, { sessionId: p.data.sessionId }));
}
