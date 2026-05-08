import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropic, buildDeviationPrompt } from "@/lib/ai";
import type { MealEntry } from "@/lib/types";

export async function POST(req: Request) {
  const { description, date } = await req.json();

  const profile = await db.userProfile.findFirst();
  if (!profile) {
    return NextResponse.json({ error: "No profile found." }, { status: 400 });
  }

  const [mealPlan, foodItems] = await Promise.all([
    db.mealPlan.findUnique({ where: { date } }),
    db.foodItem.findMany(),
  ]);

  let currentPlanTotals = null;
  if (mealPlan) {
    const entries: MealEntry[] = JSON.parse(mealPlan.meals);
    currentPlanTotals = entries.reduce(
      (acc, entry) => {
        const food = foodItems.find((f) => f.id === entry.foodItemId);
        if (!food) return acc;
        return {
          calories: acc.calories + food.calories * entry.quantity,
          protein: acc.protein + food.protein * entry.quantity,
          carbs: acc.carbs + food.carbs * entry.quantity,
          fat: acc.fat + food.fat * entry.quantity,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }

  const { system, user } = buildDeviationPrompt({ profile, description, currentPlanTotals, date });

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: user }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to analyze meal. Check ANTHROPIC_API_KEY." }, { status: 500 });
  }
}
