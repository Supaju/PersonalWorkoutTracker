import type { Client, UserProfile, ClientConsideration, ExercisePreference, Equipment, CheckIn, SessionExercise, SetLog, CardioLog, ExerciseFeedback } from "@prisma/client";
import { db } from "@/lib/db";
import { ProgramStructure, type SkipReason, type SetType, type LoadUnit } from "./schemas";
import type { LoggedSession, LoggedExercise, LoggedSet, ReadinessInput } from "./rules";

export type ContextSession = LoggedSession & { id: string; name: string | null; coachNotes: string | null };

export interface CoachContext {
  date: string;
  client: Client;
  profile: UserProfile | null;
  considerations: ClientConsideration[];
  preferences: ExercisePreference[];
  equipment: Equipment[];
  program: { id: string; version: number; structure: ProgramStructure } | null;
  history: ContextSession[];
  recentCheckIns: CheckIn[];
  checkIn: CheckIn | null;
  readiness: ReadinessInput | null;
}

export function toLoggedSession(s: {
  id: string;
  date: string;
  sessionType: string;
  phase: string;
  name: string | null;
  coachNotes: string | null;
  exercises: (SessionExercise & {
    sets: SetLog[];
    cardio: CardioLog[];
    feedback: ExerciseFeedback[];
  })[];
}): ContextSession {
  // Order exercises by orderIndex
  const sortedExercises = [...s.exercises].sort((a, b) => a.orderIndex - b.orderIndex);

  const exercises: LoggedExercise[] = sortedExercises.map((ex) => {
    // Parse muscle groups from comma-separated string
    const muscleGroups = ex.muscleGroups
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    // Order sets by setNumber
    const sortedSets = [...ex.sets].sort((a, b) => a.setNumber - b.setNumber);

    const sets: LoggedSet[] = sortedSets.map((set) => ({
      setType: set.setType as SetType,
      weight: set.weightLbs,
      reps: set.reps,
      rir: set.rir,
      durationSec: set.durationSec,
      distanceYd: set.distanceYd,
    }));

    // Parse targetReps: first check prescription JSON, then legacy targetReps string
    let targetReps: number | null = null;

    if (ex.prescription) {
      try {
        const prescription = JSON.parse(ex.prescription);
        // Find a working set with non-null reps
        if (Array.isArray(prescription)) {
          const workingSet = prescription.find(
            (ps: any) => ps.setType === "working" && ps.reps != null,
          );
          if (workingSet) {
            targetReps = workingSet.reps;
          }
        }
      } catch {
        // If prescription is invalid JSON, ignore and fall back to legacy
      }
    }

    if (targetReps === null && ex.targetReps) {
      // Parse legacy targetReps string "8-10" -> 8
      const match = ex.targetReps.match(/\d+/);
      if (match) {
        targetReps = parseInt(match[0], 10);
      }
    }

    return {
      name: ex.name,
      unit: ex.unit as LoadUnit,
      muscleGroups,
      targetReps,
      skipped: ex.skipped,
      skipReason: (ex.skipReason as SkipReason | null) || null,
      sets,
    };
  });

  return {
    id: s.id,
    date: s.date,
    sessionType: s.sessionType,
    phase: s.phase as "planned" | "active" | "recorded",
    name: s.name,
    coachNotes: s.coachNotes,
    exercises,
  };
}

export async function buildContext(
  clientId: string,
  date: string,
  checkInId?: string,
): Promise<CoachContext> {
  // Fetch client
  const client = await db.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  // Fetch profile
  const profile = await db.userProfile.findUnique({
    where: { clientId },
  });

  // Fetch active considerations
  const considerations = await db.clientConsideration.findMany({
    where: {
      clientId,
      active: true,
    },
  });

  // Fetch preferences
  const preferences = await db.exercisePreference.findMany({
    where: { clientId },
  });

  // Fetch equipment
  const equipment = await db.equipment.findMany({
    where: { clientId },
  });

  // Fetch active program (endDate null, highest version)
  const program = await db.programVersion.findFirst({
    where: {
      clientId,
      endDate: null,
    },
    orderBy: { version: "desc" },
  });

  let programData: { id: string; version: number; structure: ProgramStructure } | null = null;
  if (program) {
    const structure = ProgramStructure.parse(JSON.parse(program.structure));
    programData = {
      id: program.id,
      version: program.version,
      structure,
    };
  }

  // Fetch last 12 recorded sessions with date <= `date`, ordered OLDEST -> NEWEST
  const sessions = await db.workoutSession.findMany({
    where: {
      clientId,
      phase: "recorded",
      date: {
        lte: date,
      },
    },
    include: {
      exercises: {
        include: {
          sets: {
            orderBy: { setNumber: "asc" },
          },
          cardio: true,
          feedback: true,
        },
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { date: "desc" },
    take: 12,
  });

  // Reverse to get OLDEST -> NEWEST
  const history = sessions.reverse().map(toLoggedSession);

  // Fetch last 10 check-ins for client, newest first
  const recentCheckIns = await db.checkIn.findMany({
    where: { clientId },
    orderBy: { date: "desc" },
    take: 10,
  });

  // Fetch the check-in with checkInId if given
  let checkIn: CheckIn | null = null;
  let readiness: ReadinessInput | null = null;

  if (checkInId) {
    checkIn = await db.checkIn.findUnique({
      where: { id: checkInId },
    });

    if (checkIn && checkIn.clientId !== clientId) {
      checkIn = null;
    }
  }

  if (checkIn) {
    // Parse readiness from checkIn
    let soreness: Record<string, any> = {};
    if (checkIn.soreness) {
      try {
        soreness = JSON.parse(checkIn.soreness);
      } catch {
        soreness = {};
      }
    }

    readiness = {
      sleep: (checkIn.sleep as "poor" | "ok" | "good" | null) || null,
      energy: (checkIn.energy as "low" | "normal" | "high" | null) || null,
      soreness,
      minutesAvailable: checkIn.minutesAvailable,
    };
  }

  return {
    date,
    client,
    profile,
    considerations,
    preferences,
    equipment,
    program: programData,
    history,
    recentCheckIns,
    checkIn,
    readiness,
  };
}

/** One exercise's logged exposures across history (oldest → newest), matched by case-insensitive name. */
export function exerciseHistory(history: ContextSession[], name: string) {
  const n = name.toLowerCase();
  return history.flatMap((s) =>
    s.exercises.filter((e) => e.name.toLowerCase() === n).map((exercise) => ({ date: s.date, exercise })));
}
