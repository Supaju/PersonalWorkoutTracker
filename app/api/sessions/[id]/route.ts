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
    const { exerciseId, name, muscleGroups, targetSets, targetReps, targetWeight, aiNotes } = body;
    const ex = await db.sessionExercise.update({
      where: { id: exerciseId },
      data: {
        name,
        muscleGroups: muscleGroups ?? "",
        targetSets: Number(targetSets),
        targetReps,
        targetWeight: targetWeight ? Number(targetWeight) : null,
        aiNotes: aiNotes ?? null,
      },
    });
    return NextResponse.json(ex);
  }

  if (action === "remove_exercise") {
    const { exerciseId } = body;
    await db.sessionExercise.delete({ where: { id: exerciseId } });
    return NextResponse.json({ ok: true });
  }

  if (action === "add_exercise") {
    const { name, muscleGroups, targetSets, targetReps, targetWeight, slot, orderIndex } = body;
    const ex = await db.sessionExercise.create({
      data: {
        sessionId: id,
        slot: slot ?? "custom",
        name,
        muscleGroups: muscleGroups ?? "",
        targetSets: Number(targetSets),
        targetReps,
        targetWeight: targetWeight ? Number(targetWeight) : null,
        orderIndex: Number(orderIndex),
      },
    });
    return NextResponse.json(ex);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.workoutSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
