import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientId } from "@/lib/client";
import { parseBody, ownedSession, notFound } from "@/lib/api-util";
import { refinePlan } from "@/lib/coach/engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId();
  const { id } = await params;
  const p = await parseBody(req, z.object({ message: z.string().min(1) }));
  if ("res" in p) return p.res;
  if (!(await ownedSession(clientId, id))) return notFound();
  const { plan, reply } = await refinePlan(clientId, id, p.data.message);
  return NextResponse.json({ plan, reply });
}
