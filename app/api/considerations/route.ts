import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, notFound } from "@/lib/api-util";

const Create = z.object({
  category: z.enum(["body_size", "injury", "medical", "equipment", "other"]),
  text: z.string().min(1),
});

export async function GET() {
  const clientId = await getClientId();
  return NextResponse.json(await db.clientConsideration.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }));
}

export async function POST(req: Request) {
  const clientId = await getClientId();
  const p = await parseBody(req, Create);
  if ("res" in p) return p.res;
  return NextResponse.json(await db.clientConsideration.create({ data: { clientId, ...p.data } }));
}

/** DELETE /api/considerations?id=… (deactivates nothing: removes the row) */
export async function DELETE(req: Request) {
  const clientId = await getClientId();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { count } = await db.clientConsideration.deleteMany({ where: { id, clientId } });
  return count ? NextResponse.json({ ok: true }) : notFound();
}
