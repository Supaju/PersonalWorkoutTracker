import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropic, buildPlanPrompt } from "@/lib/ai";
import type { TemplateId } from "@/lib/templates";

export async function POST(req: Request) {
  const profile = await db.userProfile.findFirst();
  if (!profile) {
    return NextResponse.json({ error: "No profile found. Please set up your profile first." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const cycle = await db.cycleState.findUnique({ where: { id: "singleton" } });
  const template = (body.template ?? cycle?.currentTemplate ?? "upper_b") as TemplateId;

  const [equipment, allSessions] = await Promise.all([
    db.equipment.findMany(),
    db.workoutSession.findMany({
      include: { exercises: { include: { sets: true }, orderBy: { orderIndex: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const lastSameSession = allSessions.find((s) => s.template === template && s.phase === "recorded") ?? null;

  const lastAlternateLower =
    template === "lower_a"
      ? (allSessions.find((s) => s.template === "lower_b" && s.phase === "recorded") ?? null)
      : template === "lower_b"
      ? (allSessions.find((s) => s.template === "lower_a" && s.phase === "recorded") ?? null)
      : null;

  const prompt = buildPlanPrompt({
    profile,
    equipment,
    template,
    lastSameSession,
    lastAlternateLowerSession: lastAlternateLower,
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 500 });
    }

    const plan = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ template, plan });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate plan. Check ANTHROPIC_API_KEY." }, { status: 500 });
  }
}
