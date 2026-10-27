import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody } from "@/lib/api-util";
import { research } from "@/lib/coach/engine";

export async function GET() {
  const clientId = await getClientId();
  return NextResponse.json(await db.researchNote.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }));
}

export async function POST(req: Request) {
  const clientId = await getClientId();
  const p = await parseBody(req, z.object({ question: z.string().min(1) }));
  if ("res" in p) return p.res;
  return NextResponse.json(await research(clientId, p.data.question));
}
