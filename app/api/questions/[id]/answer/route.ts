import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, notFound } from "@/lib/api-util";
import { answerQuestion } from "@/lib/coach/engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId();
  const { id } = await params;
  const p = await parseBody(req, z.object({ answer: z.string().min(1) }));
  if ("res" in p) return p.res;
  if (!(await db.clarifyingQuestion.findFirst({ where: { id, session: { clientId } }, select: { id: true } }))) return notFound();
  return NextResponse.json(await answerQuestion(clientId, id, p.data.answer));
}
