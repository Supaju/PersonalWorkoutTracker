// Idempotent: seeds the owner client's Coach v2 data. Run: npm run seed:owner
import { PrismaClient } from "@prisma/client";
import { ProgramStructure } from "../lib/coach/schemas";
import { heavyLightStructure } from "../lib/coach/structures";
import { OWNER, OWNER_CONSIDERATIONS, OWNER_PREFERENCES, OWNER_HISTORY } from "../lib/coach/__fixtures__/owner-oct-2026";

const db = new PrismaClient();
// Fixture sessions carry a `name` that LoggedSession (rules.ts) does not declare.
const HISTORY = OWNER_HISTORY as (typeof OWNER_HISTORY[number] & { name: string })[];
const CLIENT = "owner";

async function counts() {
  const w = { clientId: CLIENT };
  const s = { session: w };
  return {
    WorkoutSession: await db.workoutSession.count({ where: w }),
    SessionExercise: await db.sessionExercise.count({ where: s }),
    SetLog: await db.setLog.count({ where: { exercise: s } }),
    CardioLog: await db.cardioLog.count({ where: { exercise: s } }),
    ProgramVersion: await db.programVersion.count({ where: w }),
    ClientConsideration: await db.clientConsideration.count({ where: w }),
    ExercisePreference: await db.exercisePreference.count({ where: w }),
    CheckIn: await db.checkIn.count({ where: w }),
    CoachMessage: await db.coachMessage.count({ where: w }),
  };
}

async function main() {
  const client = await db.client.findUnique({ where: { id: CLIENT } });
  if (!client) throw new Error("Client 'owner' not found. Run prisma migrate deploy first.");
  const before = await counts();

  // Settings (explicit; same as defaults)
  await db.client.update({
    where: { id: CLIENT },
    data: { trainingDays: JSON.stringify(OWNER.trainingDays), defaultMinutes: OWNER.defaultMinutes, layoffDays: OWNER.layoffDays },
  });

  // Program v1
  let v1 = await db.programVersion.findFirst({ where: { clientId: CLIENT }, orderBy: { version: "asc" } });
  if (!v1) {
    const cycle = await db.cycleState.findFirst();
    const structure = ProgramStructure.parse(heavyLightStructure());
    v1 = await db.programVersion.create({
      data: {
        clientId: CLIENT,
        version: 1,
        phase: "heavy_light_fullbody",
        startDate: "2026-10-06",
        reason: `Returning after a 4-month layoff at 370 lb: heavy/light full body. Migrated from the legacy Upper/Lower cycle (CycleState: ${cycle?.currentTemplate ?? "none"}, ${cycle?.sessionCount ?? 0} sessions).`,
        structure: JSON.stringify(structure),
      },
    });
  }

  // Profile + check-out
  const profile = await db.userProfile.findUnique({ where: { clientId: CLIENT } });
  if (profile && (profile.goalNotes !== OWNER.goalNotes || profile.weightLbs !== 370)) {
    await db.userProfile.update({ where: { clientId: CLIENT }, data: { goalNotes: OWNER.goalNotes, weightLbs: 370 } });
  }
  const hasCheckIn = await db.checkIn.findFirst({ where: { clientId: CLIENT, kind: "check_out", date: "2026-10-26", note: "Seeded from coaching conversation" } });
  if (!hasCheckIn) {
    await db.checkIn.create({ data: { clientId: CLIENT, kind: "check_out", date: "2026-10-26", bodyweightLbs: 370, note: "Seeded from coaching conversation" } });
  }

  // Considerations (no unique key: match on text)
  for (const c of OWNER_CONSIDERATIONS) {
    const exists = await db.clientConsideration.findFirst({ where: { clientId: CLIENT, text: c.text } });
    if (!exists) await db.clientConsideration.create({ data: { clientId: CLIENT, category: c.category, text: c.text } });
  }

  // Preferences
  for (const p of OWNER_PREFERENCES) {
    await db.exercisePreference.upsert({
      where: { clientId_exerciseName_kind: { clientId: CLIENT, exerciseName: p.exerciseName, kind: p.kind } },
      update: { substituteFor: p.substituteFor },
      create: { clientId: CLIENT, exerciseName: p.exerciseName, kind: p.kind, substituteFor: p.substituteFor },
    });
  }

  // October sessions
  for (const s of HISTORY) {
    const exists = await db.workoutSession.findFirst({ where: { clientId: CLIENT, date: s.date, name: s.name } });
    if (exists) continue;
    await db.workoutSession.create({
      data: {
        clientId: CLIENT,
        programVersionId: v1.id,
        date: s.date,
        template: s.sessionType,
        sessionType: s.sessionType,
        phase: "recorded",
        name: s.name,
        exercises: {
          create: s.exercises.map((e, i) => ({
            name: e.name,
            unit: e.unit,
            block: e.unit === "cardio" ? "conditioning" : "strength",
            muscleGroups: e.muscleGroups.join(", "),
            orderIndex: i,
            skipped: e.skipped,
            skipReason: e.skipReason,
            targetReps: e.targetReps == null ? "" : String(e.targetReps),
            prescription: null,
            sets: {
              create: e.sets.map((l, j) => ({
                setNumber: j + 1,
                setType: l.setType,
                weightLbs: l.weight,
                reps: l.reps,
                rir: l.rir,
                durationSec: l.durationSec ?? null,
                distanceYd: l.distanceYd ?? null,
              })),
            },
            ...(s.date === "2026-10-22" && e.name === "Recumbent Bike Intervals"
              ? {
                  cardio: {
                    create: [{
                      machine: "recumbent_bike",
                      minutes: 10,
                      intervals: "5 x 1 min hard / 1 min easy",
                      perceivedEffort: 6,
                      notes: "Plus incline walk. Decent challenge without too much strain.",
                    }],
                  },
                }
              : {}),
          })),
        },
      },
    });
  }

  // Legacy planningChat -> CoachMessage
  const legacy = await db.workoutSession.findMany({ where: { clientId: CLIENT, planningChat: { not: null } } });
  for (const s of legacy) {
    if (await db.coachMessage.count({ where: { clientId: CLIENT, sessionId: s.id } })) continue;
    let chat: { role: string; content: string }[] = [];
    try { chat = JSON.parse(s.planningChat!); } catch { continue; }
    if (!Array.isArray(chat)) continue;
    for (const [i, m] of chat.entries()) {
      await db.coachMessage.create({
        data: { clientId: CLIENT, sessionId: s.id, role: m.role, content: m.content, createdAt: new Date(s.createdAt.getTime() + i) },
      });
    }
  }

  const after = await counts();
  console.log("model".padEnd(22), "before".padStart(7), "after".padStart(7));
  for (const k of Object.keys(after) as (keyof typeof after)[]) {
    console.log(k.padEnd(22), String(before[k]).padStart(7), String(after[k]).padStart(7));
  }
}

main().then(() => db.$disconnect(), (e) => { console.error(e); process.exit(1); });
