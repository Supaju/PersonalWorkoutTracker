import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { parseBody, ownedSession, ownedExercise, notFound } from "@/lib/api-util";
import { FeedbackTag } from "@/lib/coach/schemas";
import { MODELS } from "@/lib/coach/philosophy";
import { getAnthropic } from "@/lib/coach/anthropic";

const Body = z.object({
  tags: z.array(FeedbackTag),
  painLocation: z.string().nullish(),
  painSharp: z.boolean().nullish(),
  note: z.string().nullish(),
});

/** Up to 2 substitute exercise names; best effort, never blocks the stop advice. */
async function substitutes(clientId: string, name: string, groups: string, pain: string | null | undefined): Promise<string[]> {
  try {
    const equipment = await db.equipment.findMany({ where: { clientId }, select: { name: true } });
    const res = await getAnthropic().messages.create({
      model: MODELS.routine,
      max_tokens: 100,
      messages: [{
        role: "user",
        content: `Client had sharp pain (${pain ?? "location unspecified"}) on "${name}" (${groups}). Name at most 2 substitute exercises that train the same muscles without loading the painful area, using only this equipment: ${equipment.map((e) => e.name).join(", ") || "any gym equipment"}. Reply with the names only, one per line.`,
      }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return text.split("\n").map((l) => l.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean).slice(0, 2);
  } catch {
    return [];
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; exId: string }> }) {
  const clientId = await getClientId();
  const { id, exId } = await params;
  const p = await parseBody(req, Body);
  if ("res" in p) return p.res;
  if (!(await ownedSession(clientId, id))) return notFound();
  const ex = await ownedExercise(clientId, id, exId);
  if (!ex) return notFound();
  const d = p.data;
  const row = await db.exerciseFeedback.create({
    data: { exerciseId: exId, tags: JSON.stringify(d.tags), painLocation: d.painLocation ?? null, painSharp: d.painSharp ?? null, note: d.note ?? null },
  });

  const out: { id: string; coachReply?: string; substitutes?: string[]; offerDislike?: { exerciseName: string } } = { id: row.id };
  if (d.tags.includes("joint_discomfort") && d.painSharp) {
    const subs = await substitutes(clientId, ex.name, ex.muscleGroups, d.painLocation);
    out.substitutes = subs;
    out.coachReply = `Stop this exercise for today. Sharp joint pain is a stop signal, not something to push through.${subs.length ? ` If you want to keep training those muscles, try ${subs.join(" or ")}.` : ""} If it keeps happening, it is worth having a doctor look at it.`;
  }
  if (d.tags.includes("disliked")) out.offerDislike = { exerciseName: ex.name };
  return NextResponse.json(out);
}
