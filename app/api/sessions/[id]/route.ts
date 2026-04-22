import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await db.workoutSession.findUnique({
    where: { id },
    include: { exercises: { include: { sets: { orderBy: { setNumber: "asc" } } }, orderBy: { orderIndex: "asc" } } },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { action } = body;

  if (action === "add_sets") {
    const { exerciseId, sets } = body;
    await db.setLog.deleteMany({ where: { exerciseId } });
    await db.setLog.createMany({
      data: sets.map((s: { setNumber: number; weightLbs: number; reps: number }) => ({
        exerciseId,
        setNumber: s.setNumber,
        weightLbs: s.weightLbs,
        reps: s.reps,
      })),
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_recorded") {
    const { durationMin, notes } = body;
    const session = await db.workoutSession.update({
      where: { id },
      data: { phase: "recorded", durationMin: durationMin ?? null, notes: notes ?? null },
    });
    return NextResponse.json(session);
  }

  if (action === "update_exercise") {
    const { exerciseId, name, targetSets, targetReps, targetWeight } = body;
    const ex = await db.sessionExercise.update({
      where: { id: exerciseId },
      data: { name, targetSets: Number(targetSets), targetReps, targetWeight: targetWeight ?? null },
    });
    return NextResponse.json(ex);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
