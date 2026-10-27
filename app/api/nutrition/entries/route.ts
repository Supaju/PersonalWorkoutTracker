import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";

const VALID_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;

export async function POST(req: Request) {
  const clientId = await getClientId();
  const { date, slot, description, calories, protein, carbs, fat } = await req.json();
  if (!date || !slot || !description) {
    return NextResponse.json({ error: "date, slot, and description are required" }, { status: 400 });
  }
  if (!VALID_SLOTS.includes(slot)) {
    return NextResponse.json({ error: "slot must be one of: breakfast, lunch, dinner, snack" }, { status: 400 });
  }
  try {
    const entry = await db.nutritionEntry.create({
      data: {
        clientId,
        date,
        slot,
        description,
        calories: Math.max(0, Number(calories) || 0),
        protein: Math.max(0, Number(protein) || 0),
        carbs: Math.max(0, Number(carbs) || 0),
        fat: Math.max(0, Number(fat) || 0),
        source: "manual",
      },
    });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Failed to create entry." }, { status: 500 });
  }
}
