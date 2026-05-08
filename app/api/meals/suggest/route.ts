import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropic, buildMealPlanPrompt } from "@/lib/ai";

export async function POST(req: Request) {
  const { date } = await req.json();

  const profile = await db.userProfile.findFirst();
  if (!profile) {
    return NextResponse.json({ error: "No profile found. Please set up your profile first." }, { status: 400 });
  }

  const foodItems = await db.foodItem.findMany({ orderBy: { name: "asc" } });
  if (foodItems.length === 0) {
    return NextResponse.json({ error: "No foods in your library. Add some foods first." }, { status: 400 });
  }

  const prompt = buildMealPlanPrompt({ profile, foodItems, date });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI returned an invalid response." }, { status: 500 });
    }

    const plan = JSON.parse(jsonMatch[0]);
    return NextResponse.json(plan);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate meal plan. Check ANTHROPIC_API_KEY." }, { status: 500 });
  }
}
