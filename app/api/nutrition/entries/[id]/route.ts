import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const entry = await db.nutritionEntry.update({
    where: { id },
    data: {
      ...(body.description !== undefined && { description: body.description }),
      ...(body.slot !== undefined && { slot: body.slot }),
      ...(body.calories !== undefined && { calories: Number(body.calories) }),
      ...(body.protein !== undefined && { protein: Number(body.protein) }),
      ...(body.carbs !== undefined && { carbs: Number(body.carbs) }),
      ...(body.fat !== undefined && { fat: Number(body.fat) }),
    },
  });
  return NextResponse.json(entry);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.nutritionEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
