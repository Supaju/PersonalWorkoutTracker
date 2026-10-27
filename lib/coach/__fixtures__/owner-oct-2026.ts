// Section 7 fixture: the owner's real October 2026 history. Seed data (scripts/seed-owner.ts) AND test fixture.
// Weights in lb. per_hand = weight in each hand. RIR "1–2" is recorded as 1 (conservative).
// Sets the client did not mark: first set of a multi-set exercise = ramp, rest = working.
import type { LoggedExercise, LoggedSession, LoggedSet, PreferenceRow } from "../rules";
import type { LoadUnit, SessionType } from "../schemas";

const R = (weight: number | null, reps: number | null, extra: Partial<LoggedSet> = {}): LoggedSet =>
  ({ setType: "ramp", weight, reps, rir: null, ...extra });
const W = (weight: number | null, reps: number | null, rir: number | null = null, extra: Partial<LoggedSet> = {}): LoggedSet =>
  ({ setType: "working", weight, reps, rir, ...extra });
const X = (weight: number | null, reps: number | null = null): LoggedSet =>
  ({ setType: "abandoned", weight, reps, rir: null });

const ex = (
  name: string, unit: LoadUnit, muscleGroups: string[], targetReps: number | null, sets: LoggedSet[],
  skip: Pick<LoggedExercise, "skipped" | "skipReason"> = { skipped: false, skipReason: null },
): LoggedExercise => ({ name, unit, muscleGroups, targetReps, sets, ...skip });

const session = (date: string, sessionType: SessionType, name: string, exercises: LoggedExercise[]) =>
  ({ date, sessionType, phase: "recorded" as const, name, exercises });

export const OWNER = {
  name: "Andrew",
  age: 29,
  gender: "male",
  heightIn: 74,
  weightLbs: 370,
  goals: "lose_weight",
  goalNotes: "Lose fat, build practical muscle, prepare for fatherhood and aging. Prior lifting experience; returning after a 4-month layoff.",
  trainingDays: [1, 2, 4, 5], // Mon, Tue, Thu, Fri
  defaultMinutes: 60,
  layoffDays: 10,
  rotation: ["heavy_fullbody", "light_conditioning"] as SessionType[],
  minHoursBetweenHeavy: 48,
};

export const OWNER_CONSIDERATIONS: { category: string; text: string }[] = [
  { category: "body_size", text: "Prefer supported, low-impact options: recumbent bike, incline treadmill walk, leg press over squats, seated over lying hamstring curl (prone pressure on stomach/lower back), incline plank with hands on a bench over floor plank, standing/seated stretches instead of floor work." },
  { category: "body_size", text: "Range of motion is limited by body shape (leg press depth, RDL to mid-shin, bench bar path). Cue: stop before the thighs press into the stomach or the lower back lifts off the pad." },
  { category: "equipment", text: "Check weight ratings on benches and cardio machines." },
  { category: "body_size", text: "Bench press: rack with safety arms or a spotter." },
  { category: "other", text: "Practical: water and towel, anti-chafe balm before cardio, supportive shoes on cardio days." },
];

/** Preferences learned on 10/21. */
export const OWNER_PREFERENCES: PreferenceRow[] = [
  { exerciseName: "Cable Pull-Through", kind: "disliked", substituteFor: null },
  { exerciseName: "Barbell Bench Press", kind: "substitute", substituteFor: "Machine Chest Press" },
];

/** Re-entry day 1 (not logged in detail; ~50–60% of old weights). */
const oct06 = session("2026-10-06", "reentry", "Rebuild 1", [
  ex("Goblet Squat", "per_hand", ["quads", "glutes"], 10, []),
  ex("Seated Cable Row", "total", ["upper_back", "lats", "biceps"], 12, []),
  ex("Dumbbell RDL", "per_hand", ["hamstrings", "glutes"], 10, []),
  ex("Incline Dumbbell Press", "per_hand", ["chest", "shoulders", "triceps"], 10, []),
  ex("Lat Pulldown", "total", ["lats", "biceps"], 12, []),
  ex("Pallof Press", "total", ["core"], 10, []),
  ex("Farmer Carry", "per_hand", ["forearms", "core"], null, []),
]);

const oct07 = session("2026-10-07", "light_conditioning", "Light conditioning + upper/core + mobility", []);
const oct08 = session("2026-10-08", "heavy_fullbody", "Lower body, posterior emphasis", [
  ex("Seated Hamstring Curl", "total", ["hamstrings"], 12, []),
  ex("Dumbbell RDL", "per_hand", ["hamstrings", "glutes"], 10, []),
]);

// Gap 10/09–10/20 (13 days since 10/08).

export const OCT21 = session("2026-10-21", "reentry", "Rebuild 2", [
  ex("Leg Press", "total", ["quads", "glutes"], 10, [R(180, 10), R(270, 10), W(360, 10)]),
  ex("Seated Cable Row", "total", ["upper_back", "lats", "biceps"], 12, [R(70, 12), W(85, 12), W(100, 12)]),
  ex("Cable Pull-Through", "total", ["glutes", "hamstrings"], 12, [R(50, 12), W(57.5, 12), W(65, 12)]),
  ex("Machine Chest Press", "total", ["chest", "shoulders", "triceps"], 10, [R(90, 10), W(180, 6), W(115, 7)]),
  ex("Lat Pulldown", "total", ["lats", "biceps"], 12, [R(100, 12), W(140, 12)]),
  ex("Seated Hamstring Curl", "total", ["hamstrings"], 12, [R(110, 12), W(150, 12)]),
  ex("Farmer Carry", "per_hand", ["forearms", "core", "upper_back"], null,
    [W(45, null, null, { distanceYd: 40 }), W(45, null, null, { distanceYd: 40 }), W(45, null, null, { distanceYd: 40 })]),
]);

export const OCT22 = session("2026-10-22", "light_conditioning", "Rebuild 3", [
  ex("Step-Up (12 in box)", "bodyweight", ["quads", "glutes"], 8, [W(null, 8), W(null, 8)]),
  ex("Cable Face Pull", "total", ["shoulders", "upper_back"], 15, [W(35, 15), W(42.5, 15)]),
  ex("Dumbbell Lateral Raise", "per_hand", ["shoulders"], 15, [W(20, 15), W(20, 15)]),
  ex("Dumbbell Curl", "per_hand", ["biceps"], 12, [W(25, 12), W(30, 12)]),
  ex("Rope Triceps Pushdown", "total", ["triceps"], 12, [W(60, 12), W(70, 12)]),
  ex("Hip Abduction", "total", ["abductors"], 15, [W(210, 15), W(230, 15)]),
  ex("Seated Calf Raise", "total", ["calves"], 15, [W(210, 15), W(210, 15)]),
  ex("Incline Plank", "time", ["core"], null, [W(null, null, null, { durationSec: 30 }), W(null, null, null, { durationSec: 30 })]),
  ex("Recumbent Bike Intervals", "cardio", ["conditioning"], null, []), // 5 × 1 min hard / 1 min easy + incline walk; "decent challenge without too much strain"
]);

// Missed planned session Fri 10/23; rested 10/24–10/25.

export const OCT26 = session("2026-10-26", "heavy_fullbody", "Rebuild 4", [
  ex("Barbell Bench Press", "total", ["chest", "shoulders", "triceps"], 10, [R(135, 8), R(135, 5), W(185, 10, 1), W(185, 10, 0)]),
  ex("Leg Press", "total", ["quads", "glutes"], 10, [R(180, 10), R(270, 8), W(380, 10), W(380, 10)]),
  ex("Seated Cable Row", "total", ["upper_back", "lats", "biceps"], 12, [R(70, 10), W(120, 12), W(120, 12)]),
  ex("Dumbbell RDL", "per_hand", ["hamstrings", "glutes"], 10, [R(30, 10), R(40, 10), W(50, 10)]),
  ex("Lat Pulldown", "total", ["lats", "biceps"], 12, [R(100, 10), X(150), X(150), W(120, 12), W(120, 12)]),
  ex("Seated Hamstring Curl", "total", ["hamstrings"], 12, [R(110, 10), W(160, 12), W(160, 12)]),
  ex("Farmer Carry", "per_hand", ["forearms", "core", "upper_back"], null, [], { skipped: true, skipReason: "time" }),
]);

export const OWNER_HISTORY: LoggedSession[] = [oct06, oct07, oct08, OCT21, OCT22, OCT26];

/** History as it stood before a given date (exclusive). */
export const historyBefore = (date: string) => OWNER_HISTORY.filter((s) => s.date < date);

/** Expected decisions (section 7). Tolerance ±5% on weights in evals; exact in rules tests. */
export const EXPECTED = {
  sessionTypeOn: {
    "2026-10-21": "reentry",
    "2026-10-22": "light_conditioning",
    "2026-10-26": "heavy_fullbody",
  } as Record<string, SessionType>,
  chestPress10RepEstimate: [140, 150] as const,
  nextAfterOct26: {
    "Barbell Bench Press": 175,
    "Leg Press": 400,
    "Seated Cable Row": 125,
    "Dumbbell RDL": 55,
    "Lat Pulldown": [125, 130],
    "Seated Hamstring Curl": 170,
    "Farmer Carry": 53,
  } as Record<string, number | [number, number]>,
  weekOf1026: [
    { date: "2026-10-26", status: "done", sessionType: "heavy_fullbody" },
    { date: "2026-10-27", status: "upcoming", sessionType: "light_conditioning" },
    { date: "2026-10-28", status: "rest", sessionType: null },
    { date: "2026-10-29", status: "upcoming", sessionType: "heavy_fullbody" },
    { date: "2026-10-30", status: "upcoming", sessionType: "light_conditioning" },
    { date: "2026-10-31", status: "rest", sessionType: null },
    { date: "2026-11-01", status: "rest", sessionType: null },
  ],
  missedDates: ["2026-10-23"],
};
