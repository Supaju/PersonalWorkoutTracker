import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropic, buildNutritionChatPrompt } from "@/lib/ai";
import type { NutritionChat } from "@prisma/client";

export async function POST(req: Request) {
  const { date, message } = await req.json();
  if (!date || !message) {
    return NextResponse.json({ error: "date and message are required" }, { status: 400 });
  }

  const [profile, entries, chatHistory, foodItems] = await Promise.all([
    db.userProfile.findFirst(),
    db.nutritionEntry.findMany({ where: { date }, orderBy: { createdAt: "asc" } }),
    db.nutritionChat.findMany({ where: { date }, orderBy: { createdAt: "asc" } }),
    db.foodItem.findMany(),
  ]);

  if (!profile) {
    return NextResponse.json({ error: "No profile found. Please set up your profile first." }, { status: 400 });
  }

  const { system } = buildNutritionChatPrompt({ profile, entries, foodItems, date });

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...chatHistory.map((m: NutritionChat) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";

    let reply = "";
    let parsedEntries: Array<{ description: string; slot: string; calories: number; protein: number; carbs: number; fat: number }> = [];

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        reply = parsed.reply ?? "";
        parsedEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
      } else {
        reply = text;
      }
    } catch {
      reply = text;
    }

    // Save new nutrition entries
    const createdEntries = await Promise.all(
      parsedEntries.map((e) =>
        db.nutritionEntry.create({
          data: {
            date,
            slot: e.slot,
            description: e.description,
            calories: Math.max(0, Number(e.calories) || 0),
            protein: Math.max(0, Number(e.protein) || 0),
            carbs: Math.max(0, Number(e.carbs) || 0),
            fat: Math.max(0, Number(e.fat) || 0),
            source: "ai",
          },
        })
      )
    );

    // Save chat messages (store only reply text, not full JSON)
    await db.nutritionChat.createMany({
      data: [
        { date, role: "user", content: message },
        { date, role: "assistant", content: reply },
      ],
    });

    return NextResponse.json({ reply, newEntries: createdEntries });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to get AI response. Check ANTHROPIC_API_KEY." }, { status: 500 });
  }
}
