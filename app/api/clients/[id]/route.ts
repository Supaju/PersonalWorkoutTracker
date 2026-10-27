import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseBody, notFound } from "@/lib/api-util";

const Patch = z.object({
  name: z.string().min(1).optional(),
  persona: z.string().min(1).optional(),
  active: z.boolean().optional(),
  trainingDays: z.array(z.number().int().min(0).max(6)).optional(),
  defaultMinutes: z.number().int().positive().optional(),
  hardCapMinutes: z.number().int().positive().optional(),
  layoffDays: z.number().int().positive().optional(),
  reviewEveryWeeks: z.number().int().positive().optional(),
  webResearch: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await parseBody(req, Patch);
  if ("res" in p) return p.res;
  if (!(await db.client.findUnique({ where: { id }, select: { id: true } }))) return notFound();
  const { trainingDays, ...rest } = p.data;
  return NextResponse.json(await db.client.update({
    where: { id },
    data: { ...rest, ...(trainingDays && { trainingDays: JSON.stringify(trainingDays) }) },
  }));
}
