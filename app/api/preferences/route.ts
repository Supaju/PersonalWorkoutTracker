import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, notFound } from "@/lib/api-util";

const Create = z.object({
  exerciseName: z.string().min(1),
  kind: z.enum(["disliked", "preferred", "substitute"]),
  substituteFor: z.string().nullish(),
  note: z.string().nullish(),
});

export async function GET() {
  const clientId = await getClientId();
  return NextResponse.json(await db.exercisePreference.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }));
}

export async function POST(req: Request) {
  const clientId = await getClientId();
  const p = await parseBody(req, Create);
  if ("res" in p) return p.res;
  const { exerciseName, kind, substituteFor, note } = p.data;
  const row = await db.exercisePreference.upsert({
    where: { clientId_exerciseName_kind: { clientId, exerciseName, kind } },
    create: { clientId, exerciseName, kind, substituteFor: substituteFor ?? null, note: note ?? null },
    update: { substituteFor: substituteFor ?? null, note: note ?? null },
  });
  return NextResponse.json(row);
}

/** DELETE /api/preferences?id=… */
export async function DELETE(req: Request) {
  const clientId = await getClientId();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { count } = await db.exercisePreference.deleteMany({ where: { id, clientId } });
  return count ? NextResponse.json({ ok: true }) : notFound();
}
