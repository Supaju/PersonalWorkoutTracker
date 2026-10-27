import type { LoggedExercise, LoggedSession, LoggedSet } from "../rules";
import type { LoadUnit, SkipReason } from "../schemas";
import { OWNER_HISTORY, OCT26, OCT22 } from "./owner-oct-2026";

export interface Extended {
  history: LoggedSession[];
  bodyweights: { date: string; lbs: number }[];
}

/** Add days to a YYYY-MM-DD date. */
function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/** Get the week start (Monday) for a given YYYY-MM-DD date. */
function getMonday(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getUTCDay();
  const offset = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  d.setUTCDate(d.getUTCDate() + offset);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/** Create a set object. */
function set(
  setType: "ramp" | "working",
  weight: number | null,
  reps: number | null,
  rir: number | null,
  extra?: Record<string, unknown>
): LoggedSet {
  return { setType, weight, reps, rir, ...extra };
}

/** Create an exercise object. */
function exercise(
  name: string,
  unit: LoadUnit,
  muscleGroups: string[],
  targetReps: number | null,
  sets: LoggedSet[],
  skipped = false,
  skipReason: SkipReason | null = null
): LoggedExercise {
  return { name, unit, muscleGroups, targetReps, sets, skipped, skipReason };
}

/** Create a session object. */
function session(
  date: string,
  sessionType: string,
  name: string,
  exercises: LoggedExercise[]
): LoggedSession {
  return { date, sessionType, phase: "recorded", exercises };
}

/** Round to nearest 5. */
function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

/**
 * Generate heavy_fullbody sessions with 6 exercises.
 * Weights progress: +5/week for most, +10/week for Leg Press.
 */
function heavySession(date: string, weekIndex: number): LoggedSession {
  const exercises: LoggedExercise[] = [
    {
      name: "Barbell Bench Press",
      unit: "total",
      muscleGroups: ["chest", "shoulders", "triceps"],
      targetReps: 10,
      skipped: false,
      skipReason: null,
      sets: (() => {
        const working = 175 + 5 * weekIndex;
        const ramp = roundTo5(working * 0.6);
        return [
          set("ramp", ramp, 8, null),
          set("working", working, 10, 2),
          set("working", working, 10, 2),
        ];
      })(),
    },
    {
      name: "Leg Press",
      unit: "total",
      muscleGroups: ["quads", "glutes"],
      targetReps: 10,
      skipped: false,
      skipReason: null,
      sets: (() => {
        const working = 400 + 10 * weekIndex;
        const ramp = roundTo5(working * 0.6);
        return [
          set("ramp", ramp, 8, null),
          set("working", working, 10, 2),
          set("working", working, 10, 2),
        ];
      })(),
    },
    {
      name: "Seated Cable Row",
      unit: "total",
      muscleGroups: ["upper_back", "lats", "biceps"],
      targetReps: 12,
      skipped: false,
      skipReason: null,
      sets: (() => {
        const working = 125 + 5 * weekIndex;
        const ramp = roundTo5(working * 0.6);
        return [
          set("ramp", ramp, 8, null),
          set("working", working, 12, 2),
          set("working", working, 12, 2),
        ];
      })(),
    },
    {
      name: "Dumbbell RDL",
      unit: "per_hand",
      muscleGroups: ["hamstrings", "glutes"],
      targetReps: 10,
      skipped: false,
      skipReason: null,
      sets: (() => {
        const working = 55 + 5 * weekIndex;
        const ramp = roundTo5(working * 0.6);
        return [
          set("ramp", ramp, 8, null),
          set("working", working, 10, 2),
          set("working", working, 10, 2),
        ];
      })(),
    },
    {
      name: "Lat Pulldown",
      unit: "total",
      muscleGroups: ["lats", "biceps"],
      targetReps: 12,
      skipped: false,
      skipReason: null,
      sets: (() => {
        const working = 125 + 5 * weekIndex;
        const ramp = roundTo5(working * 0.6);
        return [
          set("ramp", ramp, 8, null),
          set("working", working, 12, 2),
          set("working", working, 12, 2),
        ];
      })(),
    },
    {
      name: "Seated Hamstring Curl",
      unit: "total",
      muscleGroups: ["hamstrings"],
      targetReps: 12,
      skipped: false,
      skipReason: null,
      sets: (() => {
        const working = 170 + 5 * weekIndex;
        const ramp = roundTo5(working * 0.6);
        return [
          set("ramp", ramp, 8, null),
          set("working", working, 12, 2),
          set("working", working, 12, 2),
        ];
      })(),
    },
  ];

  return session(date, "heavy_fullbody", "Heavy", exercises);
}

/**
 * Generate light_conditioning sessions, copying exercise structure from OCT22.
 */
function lightSession(date: string, weekIndex: number): LoggedSession {
  const exercises: LoggedExercise[] = [
    exercise(
      "Step-Up (12 in box)",
      "bodyweight",
      ["quads", "glutes"],
      8,
      [
        set("working", null, 8, 2),
        set("working", null, 8, 2),
      ]
    ),
    exercise(
      "Cable Face Pull",
      "total",
      ["shoulders", "upper_back"],
      15,
      [
        set("working", 35, 15, 2),
        set("working", 42.5, 15, 2),
      ]
    ),
    exercise(
      "Dumbbell Lateral Raise",
      "per_hand",
      ["shoulders"],
      15,
      [
        set("working", 20, 15, 2),
        set("working", 20, 15, 2),
      ]
    ),
    exercise(
      "Dumbbell Curl",
      "per_hand",
      ["biceps"],
      12,
      [
        set("working", 25, 12, 2),
        set("working", 30, 12, 2),
      ]
    ),
    exercise(
      "Rope Triceps Pushdown",
      "total",
      ["triceps"],
      12,
      [
        set("working", 60, 12, 2),
        set("working", 70, 12, 2),
      ]
    ),
    exercise(
      "Hip Abduction",
      "total",
      ["abductors"],
      15,
      [
        set("working", 210, 15, 2),
        set("working", 230, 15, 2),
      ]
    ),
    exercise(
      "Seated Calf Raise",
      "total",
      ["calves"],
      15,
      [
        set("working", 210, 15, 2),
        set("working", 210, 15, 2),
      ]
    ),
    exercise(
      "Incline Plank",
      "time",
      ["core"],
      null,
      [
        set("working", null, null, 2, { durationSec: 30 }),
        set("working", null, null, 2, { durationSec: 30 }),
      ]
    ),
    exercise(
      "Recumbent Bike Intervals",
      "cardio",
      ["conditioning"],
      null,
      [] // Empty sets like OCT22
    ),
  ];

  // Accessories progress +5 lb/week over the 10/22 weights, so the fixture has no stalled lifts.
  for (const e of exercises) for (const s of e.sets) if (s.weight != null) s.weight += 5 * (weekIndex + 1);
  return session(date, "light_conditioning", "Light", exercises);
}

/**
 * Generate 5 weeks of consistent training (Mon heavy, Tue light, Thu heavy, Fri light).
 * Starting Monday 2026-11-02.
 */
export function consistentWeeks(n = 5): Extended {
  const generated: LoggedSession[] = [];
  const bodyweights: { date: string; lbs: number }[] = [];

  const weekStartDate = "2026-11-02"; // Monday

  for (let w = 0; w < n; w++) {
    const monDate = addDays(weekStartDate, 7 * w);
    const tueDate = addDays(monDate, 1);
    const thuDate = addDays(monDate, 3);
    const friDate = addDays(monDate, 4);

    // Heavy on Monday
    generated.push(heavySession(monDate, w));

    // Light on Tuesday
    generated.push(lightSession(tueDate, w));

    // Heavy on Thursday
    generated.push(heavySession(thuDate, w));

    // Light on Friday
    generated.push(lightSession(friDate, w));

    // Bodyweight on Monday
    const bw = 370 - 2 * w;
    bodyweights.push({ date: monDate, lbs: bw });
  }

  return {
    history: [...OWNER_HISTORY, ...generated],
    bodyweights,
  };
}

/**
 * Generate consistent weeks, but from week index 3 on, switch to upper_a/lower_a/upper_b/lower_b.
 * Include a layoff period after, returning the final `today` date.
 */
export function layoffAfter(weeks = 5, layoffDays = 21): Extended & { today: string } {
  const generated: LoggedSession[] = [];
  const bodyweights: { date: string; lbs: number }[] = [];

  const weekStartDate = "2026-11-02"; // Monday
  let lastSessionDate = "";

  for (let w = 0; w < weeks; w++) {
    const monDate = addDays(weekStartDate, 7 * w);
    const tueDate = addDays(monDate, 1);
    const thuDate = addDays(monDate, 3);
    const friDate = addDays(monDate, 4);

    let monType = "heavy_fullbody";
    let tueType = "light_conditioning";
    let thuType = "heavy_fullbody";
    let friType = "light_conditioning";

    if (w >= 3) {
      monType = "upper_a";
      tueType = "lower_a";
      thuType = "upper_b";
      friType = "lower_b";
    }

    // Heavy exercises for Mon/Thu; light for Tue/Fri
    const monExercises = (w >= 3 ? "upper_a" : "heavy_fullbody");
    const tueExercises = (w >= 3 ? "lower_a" : "light_conditioning");
    const thuExercises = (w >= 3 ? "upper_b" : "heavy_fullbody");
    const friExercises = (w >= 3 ? "lower_b" : "light_conditioning");

    // Monday (upper/heavy)
    generated.push({
      ...heavySession(monDate, w),
      sessionType: monType,
    });
    lastSessionDate = monDate;

    // Tuesday (lower/light)
    generated.push({
      ...lightSession(tueDate, w),
      sessionType: tueType,
    });
    lastSessionDate = tueDate;

    // Thursday (upper/heavy)
    generated.push({
      ...heavySession(thuDate, w),
      sessionType: thuType,
    });
    lastSessionDate = thuDate;

    // Friday (lower/light)
    generated.push({
      ...lightSession(friDate, w),
      sessionType: friType,
    });
    lastSessionDate = friDate;

    // Bodyweight on Monday
    const bw = 370 - 2 * w;
    bodyweights.push({ date: monDate, lbs: bw });
  }

  const today = addDays(lastSessionDate, layoffDays + 1);

  return {
    history: [...OWNER_HISTORY, ...generated],
    bodyweights,
    today,
  };
}
