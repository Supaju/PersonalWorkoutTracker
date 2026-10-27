import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";

/** Current version (endDate null), full history, and proposals (newest first). */
export async function GET() {
  const clientId = await getClientId();
  const [versions, proposals] = await Promise.all([
    db.programVersion.findMany({ where: { clientId }, orderBy: { version: "desc" } }),
    db.programProposal.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({ current: versions.find((v) => !v.endDate) ?? null, history: versions, proposals });
}
