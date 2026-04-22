import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const sessions = await db.workoutSession.findMany({
    include: { exercises: { include: { sets: true }, orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { date, template, notes, exercises } = body;

  const session = await db.workoutSession.create({
    data: {
      date,
      template,
      notes: notes || null,
      phase: "planned",
      exercises: {
        create: exercises.map(
          (ex: {
            slot: string;
            name: string;
            muscleGroups: string;
            targetSets: number;
            targetReps: string;
            targetWeight: number | null;
            orderIndex: number;
            aiNotes: string | null;
          }) => ({
            slot: ex.slot,
            name: ex.name,
            muscleGroups: ex.muscleGroups,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps,
            targetWeight: ex.targetWeight ?? null,
            orderIndex: ex.orderIndex,
            aiNotes: ex.aiNotes ?? null,
          })
        ),
      },
    },
    include: { exercises: { include: { sets: true } } },
  });

  return NextResponse.json(session);
}
