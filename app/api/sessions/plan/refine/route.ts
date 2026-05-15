import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropic, buildPlanPrompt, buildRefinePrompt } from "@/lib/ai";
import type { TemplateId } from "@/lib/templates";
import type { PlannedExercise, Message } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { template, currentExercises, initialPlanJson, messages, userMessage } = body as {
      template: TemplateId;
      currentExercises: PlannedExercise[];
      initialPlanJson: string;
      messages: Message[];
      userMessage: string;
    };

    if (!template || !userMessage || !Array.isArray(messages) || !Array.isArray(currentExercises)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const profile = await db.userProfile.findFirst();
    if (!profile) {
      return NextResponse.json({ error: "No profile found." }, { status: 400 });
    }

    const [equipment, allSessions] = await Promise.all([
      db.equipment.findMany(),
      db.workoutSession.findMany({
        include: { exercises: { include: { sets: true }, orderBy: { orderIndex: "asc" } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const lastSameSession =
      allSessions.find((s) => s.template === template && s.phase === "recorded") ?? null;
    const lastAlternateLower =
      template === "lower_a"
        ? (allSessions.find((s) => s.template === "lower_b" && s.phase === "recorded") ?? null)
        : template === "lower_b"
        ? (allSessions.find((s) => s.template === "lower_a" && s.phase === "recorded") ?? null)
        : null;

    const planPrompt = buildPlanPrompt({
      profile,
      equipment,
      template,
      lastSameSession,
      lastAlternateLowerSession: lastAlternateLower,
    });

    const claudeMessages: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: planPrompt.user },
      { role: "assistant", content: initialPlanJson },
      ...messages,
      {
        role: "user",
        content: `${userMessage}\n\nCurrent exercise list for reference:\n${JSON.stringify(currentExercises, null, 2)}`,
      },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: buildRefinePrompt(),
      messages: claudeMessages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    if (!result.reply || !Array.isArray(result.exercises)) {
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 500 });
    }

    return NextResponse.json({ reply: result.reply, exercises: result.exercises });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to refine plan. Check ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }
}
