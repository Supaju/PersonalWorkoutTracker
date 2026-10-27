import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody } from "@/lib/api-util";
import { SessionType, SetType, LoadUnit, Block } from "@/lib/coach/schemas";

const full = { exercises: { include: { sets: { orderBy: { setNumber: "asc" as const } }, cardio: true }, orderBy: { orderIndex: "asc" as const } } };

export async function GET() {
  const clientId = await getClientId();
  return NextResponse.json(await db.workoutSession.findMany({
    where: { clientId }, include: full, orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  }));
}

const Manual = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessionType: SessionType.optional(),
  name: z.string().optional(),
  notes: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  exercises: z.array(z.object({
    name: z.string().min(1),
    muscleGroups: z.array(z.string()).default([]),
    unit: LoadUnit.default("total"),
    block: Block.default("strength"),
    sets: z.array(z.object({
      setType: SetType.default("working"),
      weightLbs: z.number().nullish(), reps: z.number().int().nullish(), rir: z.number().int().min(0).max(4).nullish(),
      durationSec: z.number().int().nullish(), distanceYd: z.number().nullish(), notes: z.string().nullish(),
    })).default([]),
  })).min(1),
});

/** Manual / after-the-fact session with the full set grid. Created already recorded. */
export async function POST(req: Request) {
  const clientId = await getClientId();
  const p = await parseBody(req, Manual);
  if ("res" in p) return p.res;
  const d = p.data;
  const session = await db.workoutSession.create({
    data: {
      clientId, date: d.date, template: "manual", sessionType: d.sessionType ?? "legacy", phase: "recorded",
      name: d.name ?? null, notes: d.notes ?? null, durationMin: d.durationMin ?? null,
      exercises: {
        create: d.exercises.map((ex, i) => ({
          name: ex.name, muscleGroups: ex.muscleGroups.join(", "), unit: ex.unit, block: ex.block, orderIndex: i,
          sets: {
            create: ex.sets.map((s, n) => ({
              setNumber: n + 1, setType: s.setType, weightLbs: s.weightLbs ?? null, reps: s.reps ?? null,
              rir: s.rir ?? null, durationSec: s.durationSec ?? null, distanceYd: s.distanceYd ?? null, notes: s.notes ?? null,
            })),
          },
        })),
      },
    },
    include: full,
  });
  return NextResponse.json(session);
}
