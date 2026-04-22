import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const foods = await db.foodItem.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(foods);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, calories, protein, carbs, fat, serving } = body;
  const food = await db.foodItem.create({
    data: {
      name,
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      serving: serving || null,
    },
  });
  return NextResponse.json(food);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.foodItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
