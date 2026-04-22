import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const cycle = await db.cycleState.findUnique({ where: { id: "singleton" } });
  if (!cycle) {
    const created = await db.cycleState.create({
      data: { id: "singleton", currentTemplate: "upper_b", sessionCount: 0 },
    });
    return NextResponse.json(created);
  }
  return NextResponse.json(cycle);
}
