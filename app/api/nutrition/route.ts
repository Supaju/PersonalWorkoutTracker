import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AI_CONFIG } from "@/lib/ai-config";
import { getClientId } from "@/lib/client";

export async function GET(req: Request) {
  const clientId = await getClientId();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const [entries, chat, profile] = await Promise.all([
    db.nutritionEntry.findMany({ where: { clientId, date }, orderBy: { createdAt: "asc" } }),
    db.nutritionChat.findMany({ where: { clientId, date }, orderBy: { createdAt: "asc" } }),
    db.userProfile.findUnique({ where: { clientId } }),
  ]);

  let targets = { calories: 2000, protein: AI_CONFIG.nutrition.proteinMinGrams };
  if (profile) {
    const weightKg = profile.weightLbs / 2.205;
    const heightCm = profile.heightIn * 2.54;
    const bmrBase = 10 * weightKg + 6.25 * heightCm - 5 * profile.age;
    const bmr = profile.gender === "female" ? bmrBase - 161 : bmrBase + 5;
    const tdee = Math.round(bmr * AI_CONFIG.nutrition.activityMultiplier);
    targets = { calories: tdee - 625, protein: AI_CONFIG.nutrition.proteinMinGrams };
  }

  return NextResponse.json({ entries, chat, targets });
}
