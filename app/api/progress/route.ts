import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientId } from "@/lib/client";
import { localDate } from "@/lib/coach/today";

const day = (date: string) => new Date(`${date}T12:00:00`);
function weekStart(date: string): string {
  const d = day(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return localDate(d);
}
/** Epley e1RM with reps-in-reserve folded into reps; unrecorded RIR assumed 2. */
const e1rm = (w: number, reps: number, rir: number | null) => Math.round(w * (1 + (reps + (rir ?? 2)) / 30));

export async function GET() {
  const clientId = await getClientId();
  const [client, sessions, checkIns, versions] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: clientId }, include: { profile: true } }),
    db.workoutSession.findMany({
      where: { clientId, phase: "recorded" },
      include: { exercises: { include: { sets: true, cardio: true } } },
      orderBy: { date: "asc" },
    }),
    db.checkIn.findMany({ where: { clientId, bodyweightLbs: { not: null } }, orderBy: { date: "asc" } }),
    db.programVersion.findMany({ where: { clientId }, orderBy: { version: "asc" } }),
  ]);

  const byEx = new Map<string, { name: string; unit: string; series: { date: string; topWeight: number; e1rm: number }[] }>();
  const cardioByWeek = new Map<string, number>();
  const doneByWeek = new Map<string, number>();
  for (const s of sessions) {
    const wk = weekStart(s.date);
    doneByWeek.set(wk, (doneByWeek.get(wk) ?? 0) + 1);
    for (const ex of s.exercises) {
      for (const c of ex.cardio) cardioByWeek.set(wk, (cardioByWeek.get(wk) ?? 0) + c.minutes);
      if (ex.skipped) continue;
      const working = ex.sets.filter((t) => t.setType === "working" && t.weightLbs != null && t.reps != null && t.weightLbs > 0);
      if (!working.length) continue;
      const key = ex.name.toLowerCase();
      const entry = byEx.get(key) ?? { name: ex.name, unit: ex.unit, series: [] };
      entry.series.push({
        date: s.date,
        topWeight: Math.max(...working.map((t) => t.weightLbs!)),
        e1rm: Math.max(...working.map((t) => e1rm(t.weightLbs!, t.reps!, t.rir))),
      });
      byEx.set(key, entry);
    }
  }

  const bodyweight = checkIns.map((c) => ({ date: c.date, lbs: c.bodyweightLbs! }));
  if (client.profile) bodyweight.unshift({ date: localDate(client.profile.updatedAt), lbs: client.profile.weightLbs });

  // Adherence: planned = training days in each week from the first session's week to this week (up to today).
  const trainingDays = JSON.parse(client.trainingDays) as number[];
  const today = localDate();
  const adherence: { weekStart: string; planned: number; completed: number }[] = [];
  if (sessions.length) {
    for (let wk = weekStart(sessions[0].date); wk <= today; ) {
      let planned = 0;
      for (let i = 0; i < 7; i++) {
        const d = day(wk);
        d.setDate(d.getDate() + i);
        if (localDate(d) <= today && trainingDays.includes(d.getDay())) planned++;
      }
      adherence.push({ weekStart: wk, planned, completed: doneByWeek.get(wk) ?? 0 });
      const n = day(wk);
      n.setDate(n.getDate() + 7);
      wk = localDate(n);
    }
  }

  return NextResponse.json({
    exercises: [...byEx.values()],
    bodyweight,
    adherence,
    cardioMinutesByWeek: [...cardioByWeek].map(([week, minutes]) => ({ weekStart: week, minutes })),
    versionMarkers: versions.map((v) => ({ version: v.version, phase: v.phase, startDate: v.startDate })),
  });
}
