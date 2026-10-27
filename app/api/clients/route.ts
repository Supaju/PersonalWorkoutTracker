import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/api-util";
import { DEFAULT_PERSONA } from "@/lib/coach/philosophy";

const Schedule = z.object({
  trainingDays: z.array(z.number().int().min(0).max(6)).optional(),
  defaultMinutes: z.number().int().positive().optional(),
  hardCapMinutes: z.number().int().positive().optional(),
  layoffDays: z.number().int().positive().optional(),
  reviewEveryWeeks: z.number().int().positive().optional(),
  webResearch: z.boolean().optional(),
});

const Create = z.object({
  name: z.string().min(1),
  persona: z.string().min(1).optional(),
  profile: z.object({
    age: z.number().int().positive(), gender: z.string(), heightIn: z.number().positive(),
    weightLbs: z.number().positive(), goals: z.string(), goalNotes: z.string().nullish(),
  }).optional(),
  schedule: Schedule.optional(),
});

export async function GET() {
  return NextResponse.json(await db.client.findMany({ orderBy: { createdAt: "asc" }, include: { profile: true } }));
}

export async function POST(req: Request) {
  const p = await parseBody(req, Create);
  if ("res" in p) return p.res;
  const { name, persona, profile, schedule } = p.data;
  const { trainingDays, ...rest } = schedule ?? {};
  const client = await db.client.create({
    data: {
      name, persona: persona ?? DEFAULT_PERSONA, ...rest,
      ...(trainingDays && { trainingDays: JSON.stringify(trainingDays) }),
      ...(profile && { profile: { create: { name, ...profile } } }),
    },
    include: { profile: true },
  });
  return NextResponse.json(client);
}
