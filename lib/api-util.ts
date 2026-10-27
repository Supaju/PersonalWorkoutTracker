// Small helpers shared by API routes: validation, 404s, ownership checks. Every lookup filters by clientId.
import Anthropic from "@anthropic-ai/sdk";
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

/**
 * Run a route body that calls the model; turn API failures into a readable JSON error instead of a bare 500.
 * Anything that isn't an Anthropic API error is rethrown.
 */
export async function withAI(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof Anthropic.APIError)) throw e;
    console.error(e);
    const msg = e.message ?? "";
    const error = /credit balance/i.test(msg)
      ? "The coach is unavailable: the Anthropic account is out of credits. Add credits in the Anthropic Console (Plans & Billing), then try again."
      : e.status === 401
      ? "The coach is unavailable: ANTHROPIC_API_KEY is missing or invalid."
      : e.status === 429 || (e.status ?? 0) >= 500
      ? "The coach is busy or temporarily unavailable. Try again in a minute."
      : `The coach request failed (${e.status ?? "network"}).`;
    return NextResponse.json({ error }, { status: 502 });
  }
}
