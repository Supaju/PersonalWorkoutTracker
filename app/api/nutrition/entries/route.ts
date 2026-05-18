import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { date, slot, description, calories, protein, carbs, fat } = await req.json();
  if (!date || !slot || !description) {
    return NextResponse.json({ error: "date, slot, and description are required" }, { status: 400 });
  }
  const entry = await db.nutritionEntry.create({
    data: {
      date,
      slot,
      description,
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      source: "manual",
    },
  });
  return NextResponse.json(entry);
}
