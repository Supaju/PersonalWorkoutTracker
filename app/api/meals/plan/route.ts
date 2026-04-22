import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
  const plan = await db.mealPlan.findUnique({ where: { date } });
  return NextResponse.json(plan);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { date, meals } = body;

  const plan = await db.mealPlan.upsert({
    where: { date },
    create: { date, meals: JSON.stringify(meals) },
    update: { meals: JSON.stringify(meals) },
  });

  return NextResponse.json(plan);
}
