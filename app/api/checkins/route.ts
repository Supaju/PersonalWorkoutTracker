import { NextResponse } from "next/server";
import { getClientId } from "@/lib/client";
import { parseBody, ownedSession, notFound } from "@/lib/api-util";
import { CheckInInput } from "@/lib/coach/schemas";
import { createCheckIn } from "@/lib/coach/today";

export async function POST(req: Request) {
  const clientId = await getClientId();
  const p = await parseBody(req, CheckInInput);
  if ("res" in p) return p.res;
  if (p.data.sessionId && !(await ownedSession(clientId, p.data.sessionId))) return notFound();
  const row = await createCheckIn(clientId, p.data);
  return NextResponse.json({ id: row.id });
}
