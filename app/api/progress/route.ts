import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const MUSCLE_GROUP_KEYWORDS: Record<string, string[]> = {
  legs: ["quad", "glute", "hamstring", "calf", "hip"],
  chest: ["chest", "pec"],
  back: ["lat", "rhomboid", "trap", "row"],
  shoulders: ["delt", "shoulder"],
  arms: ["bicep", "tricep", "forearm", "curl"],
};

function getMuscleGroup(muscleGroups: string): string {
  const lower = muscleGroups.toLowerCase();
  for (const [group, keywords] of Object.entries(MUSCLE_GROUP_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return group;
  }
  return "other";
}

export async function GET() {
  try {
    const sessions = await db.workoutSession.findMany({
      where: { phase: "recorded" },
      include: {
        exercises: {
          include: { sets: true },
        },
      },
      orderBy: { date: "asc" },
    });

    const exerciseMap = new Map<
      string,
      {
        name: string;
        muscleGroup: string;
        data: { date: string; maxWeight: number; volume: number; sets: number; reps: number }[];
      }
    >();

    for (const session of sessions) {
      for (const ex of session.exercises) {
        if (ex.sets.length === 0) continue;

        const key = ex.name.toLowerCase();
        if (!exerciseMap.has(key)) {
          exerciseMap.set(key, {
            name: ex.name,
            muscleGroup: getMuscleGroup(ex.muscleGroups),
            data: [],
          });
        }

        const maxSet = ex.sets.reduce(
          (best, s) => (s.weightLbs > best.weightLbs ? s : best),
          ex.sets[0]
        );
        const volume = ex.sets.reduce((sum, s) => sum + s.weightLbs * s.reps, 0);

        exerciseMap.get(key)!.data.push({
          date: session.date,
          maxWeight: maxSet.weightLbs,
          volume,
          sets: ex.sets.length,
          reps: maxSet.reps,
        });
      }
    }

    const exercises = Array.from(exerciseMap.values());

    const recentPRs = exercises
      .flatMap((ex) => {
        const latest = ex.data[ex.data.length - 1];
        const allTimeMax = Math.max(...ex.data.map((d) => d.maxWeight));
        if (latest.maxWeight < allTimeMax) return [];
        const prev = ex.data[ex.data.length - 2];
        return [
          {
            name: ex.name,
            weight: latest.maxWeight,
            delta: prev ? latest.maxWeight - prev.maxWeight : 0,
          },
        ];
      })
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 4);

    return NextResponse.json({ exercises, recentPRs });
  } catch (err) {
    console.error("[progress] DB error", err);
    return NextResponse.json({ error: "Failed to load progress" }, { status: 500 });
  }
}
