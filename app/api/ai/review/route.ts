import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropic, buildReviewPrompt } from "@/lib/ai";
import { getClientId } from "@/lib/client";
import type { TemplateId } from "@/lib/templates";

export async function POST() {
  const clientId = await getClientId();
  const profile = await db.userProfile.findUnique({ where: { clientId } });
  if (!profile) {
    return NextResponse.json({ error: "No profile found. Please set up your profile first." }, { status: 400 });
  }

  const cycle = await db.cycleState.findUnique({ where: { id: "singleton" } });
  const currentTemplate = (cycle?.currentTemplate ?? "upper_b") as TemplateId;

  const [equipment, recentSessions, foodItems, client] = await Promise.all([
    db.equipment.findMany({ where: { clientId } }),
    db.workoutSession.findMany({
      include: { exercises: { include: { sets: true }, orderBy: { orderIndex: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.foodItem.findMany({ orderBy: { name: "asc" } }),
    db.client.findUniqueOrThrow({ where: { id: clientId }, select: { persona: true } }),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const mealPlan = await db.mealPlan.findUnique({ where: { clientId_date: { clientId, date: today } } });

  const prompt = buildReviewPrompt({
    profile,
    equipment,
    recentSessions,
    foodItems,
    mealPlan,
    currentTemplate,
    persona: client.persona,
  });

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
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
      await db.aIReview.create({ data: { clientId, reviewText: fullText, category: "overall" } });
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
  });
}

export async function GET() {
  const clientId = await getClientId();
  const reviews = await db.aIReview.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 10 });
  return NextResponse.json(reviews);
}
