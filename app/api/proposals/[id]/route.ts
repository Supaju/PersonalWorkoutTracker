import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, notFound } from "@/lib/api-util";
import { decideProposal } from "@/lib/coach/program-review";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId();
  const { id } = await params;
  const p = await parseBody(req, z.object({ decision: z.enum(["accept", "reject"]), response: z.string().optional() }));
  if ("res" in p) return p.res;
  const prop = await db.programProposal.findFirst({ where: { id, clientId } });
  if (!prop) return notFound();
  if (prop.status !== "pending") return NextResponse.json({ error: `Proposal already ${prop.status}` }, { status: 409 });
  return NextResponse.json(await decideProposal(clientId, id, p.data.decision, p.data.response));
}
