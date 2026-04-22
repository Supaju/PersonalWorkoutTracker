import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNextTemplate, type TemplateId } from "@/lib/templates";

export async function POST() {
  const cycle = await db.cycleState.findUnique({ where: { id: "singleton" } });
  const current = (cycle?.currentTemplate ?? "upper_b") as TemplateId;
  const next = getNextTemplate(current);

  const updated = await db.cycleState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", currentTemplate: next, sessionCount: 1 },
    update: { currentTemplate: next, sessionCount: { increment: 1 } },
  });

  return NextResponse.json(updated);
}
