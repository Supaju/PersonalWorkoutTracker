import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";

const VALID_SLOTS = new Set(["breakfast", "lunch", "dinner", "snack"]);

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId();
  const { id } = await params;
  const body = await req.json();
  if (body.slot !== undefined && !VALID_SLOTS.has(body.slot)) {
    return NextResponse.json({ error: "Invalid slot." }, { status: 400 });
  }
  const existing = await db.nutritionEntry.findFirst({ where: { id, clientId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
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
  } catch {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId();
  const { id } = await params;
  const existing = await db.nutritionEntry.findFirst({ where: { id, clientId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await db.nutritionEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
}
