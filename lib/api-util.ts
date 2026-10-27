// Small helpers shared by API routes: validation, 404s, ownership checks. Every lookup filters by clientId.
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { db } from "@/lib/db";

export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/** Parse the JSON body with a zod schema. Returns data or a ready-made 400 response. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<{ data: T } | { res: NextResponse }> {
  let raw: unknown;
  try { raw = await req.json(); } catch { raw = undefined; }
  const r = schema.safeParse(raw);
  if (!r.success) return { res: NextResponse.json({ error: "Invalid input", issues: r.error.issues }, { status: 400 }) };
  return { data: r.data };
}

export const ownedSession = (clientId: string, id: string) =>
  db.workoutSession.findFirst({ where: { id, clientId } });

export const ownedExercise = (clientId: string, sessionId: string, id: string) =>
  db.sessionExercise.findFirst({ where: { id, sessionId, session: { clientId } } });

/** Spread into a response of any edit to a session's sets/exercises: tells the UI to call /review again. */
export const reReview = (s: { reviewedAt: Date | null }) => (s.reviewedAt ? { needsReReview: true } : {});
