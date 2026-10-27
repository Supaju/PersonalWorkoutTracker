// Prisma rows → rules.ts input shapes.
import type { Prisma } from "@prisma/client";
import type { LoggedSession, LoggedExercise } from "./rules";
import type { BodyArea, SkipReason } from "./schemas";

export type SessionWithSets = Prisma.WorkoutSessionGetPayload<{
  include: { exercises: { include: { sets: true } } };
}>;

function targetRepsOf(ex: { targetReps: string; prescription: string | null }): number | null {
  const m = /\d+/.exec(ex.targetReps);
  if (m) return Number(m[0]);
  try {
    const sets = JSON.parse(ex.prescription ?? "[]") as { setType: string; reps: number | null }[];
    return sets.find((s) => s.setType === "working")?.reps ?? null;
  } catch {
    return null;
  }
}

export function toLoggedSession(s: SessionWithSets): LoggedSession {
  return {
    date: s.date,
    sessionType: s.sessionType,
    phase: s.phase as LoggedSession["phase"],
    exercises: [...s.exercises].sort((a, b) => a.orderIndex - b.orderIndex).map((ex): LoggedExercise => ({
      name: ex.name,
      unit: ex.unit as LoggedExercise["unit"],
      muscleGroups: ex.muscleGroups.split(",").map((g) => g.trim()).filter(Boolean),
      targetReps: targetRepsOf(ex),
      skipped: ex.skipped,
      skipReason: (ex.skipReason as SkipReason | null) ?? null,
      sets: [...ex.sets].sort((a, b) => a.setNumber - b.setNumber).map((st) => ({
        setType: st.setType as "ramp" | "working" | "abandoned",
        weight: st.weightLbs,
        reps: st.reps,
        rir: st.rir,
        durationSec: st.durationSec,
        distanceYd: st.distanceYd,
      })),
    })),
  };
}

// Free-text muscle group → BodyArea; all matches are collected.
const AREA_SYNONYMS: [RegExp, BodyArea][] = [
  [/chest|pec/, "chest"], [/shoulder|delt/, "shoulders"], [/upper.?back|trap|rhomboid|rear/, "upper_back"],
  [/lat/, "lats"], [/bicep|curl/, "biceps"], [/tricep/, "triceps"], [/forearm|grip/, "forearms"],
  [/core|\babs?\b|abdominal|oblique/, "core"], [/lower.?back|erector|lumbar/, "lower_back"], [/glute/, "glutes"],
  [/quad/, "quads"], [/hamstring/, "hamstrings"], [/adductor/, "adductors"], [/abductor/, "abductors"], [/calf|calves/, "calves"],
];

export function toBodyAreas(groups: string[]): BodyArea[] {
  const out = new Set<BodyArea>();
  for (const g of groups.map((x) => x.toLowerCase())) for (const [re, area] of AREA_SYNONYMS) if (re.test(g)) out.add(area);
  return [...out];
}
