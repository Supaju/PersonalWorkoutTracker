import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropic, buildReviewPrompt } from "@/lib/ai";
import type { TemplateId } from "@/lib/templates";

export async function POST() {
  const profile = await db.userProfile.findFirst();
  if (!profile) {
    return NextResponse.json({ error: "No profile found. Please set up your profile first." }, { status: 400 });
  }

  const cycle = await db.cycleState.findUnique({ where: { id: "singleton" } });
  const currentTemplate = (cycle?.currentTemplate ?? "upper_b") as TemplateId;

  const [equipment, recentSessions, foodItems] = await Promise.all([
    db.equipment.findMany(),
    db.workoutSession.findMany({
      include: { exercises: { include: { sets: true }, orderBy: { orderIndex: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.foodItem.findMany({ orderBy: { name: "asc" } }),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const mealPlan = await db.mealPlan.findUnique({ where: { date: today } });

  const prompt = buildReviewPrompt({
    profile,
    equipment,
    recentSessions,
    foodItems,
    mealPlan,
    currentTemplate,
  });

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let fullText = "";
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          fullText += chunk.delta.text;
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      await db.aIReview.create({ data: { reviewText: fullText, category: "overall" } });
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
  });
}

export async function GET() {
  const reviews = await db.aIReview.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
  return NextResponse.json(reviews);
}
