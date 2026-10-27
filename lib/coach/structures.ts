import { ProgramStructure } from "./schemas";
import { PHILOSOPHY } from "./philosophy";
import { TEMPLATES, CYCLE_ORDER } from "../templates";

export function heavyLightStructure(): ProgramStructure {
  return ProgramStructure.parse({
    phase: "heavy_light_fullbody",
    description: "Heavy full body and light conditioning days alternate across the training days; heavy days need about 48 hours apart.",
    rotation: ["heavy_fullbody", "light_conditioning"],
    sessionTypes: {
      heavy_fullbody: {
        label: "Heavy full body",
        focus: "Big compound patterns (press, squat/leg press, row, hinge, pull), paired as supersets, with a conditioning finisher",
        exercisePool: ["Barbell Bench Press","Leg Press","Seated Cable Row","Dumbbell RDL","Lat Pulldown","Seated Hamstring Curl","Farmer Carry","Incline Dumbbell Press","Goblet Squat","Sled Push"],
      },
      light_conditioning: {
        label: "Light conditioning",
        focus: "Shoulders and rear delts, arms, abductors, calves, core, plus bike intervals",
        exercisePool: ["Step-Up","Cable Face Pull","Dumbbell Lateral Raise","Dumbbell Curl","Rope Triceps Pushdown","Hip Abduction","Seated Calf Raise","Incline Plank","Recumbent Bike Intervals","Incline Treadmill Walk"],
      },
      reentry: {
        label: "Re-entry",
        focus: "Same patterns as the heavy day at or below previous weights, to rebuild after a layoff",
        exercisePool: ["Barbell Bench Press","Leg Press","Seated Cable Row","Dumbbell RDL","Lat Pulldown","Seated Hamstring Curl","Farmer Carry","Incline Dumbbell Press","Goblet Squat","Sled Push"],
      },
    },
    progression: PHILOSOPHY.load.join(" "),
    conditioning: "Conditioning every session: 8-20 minutes after strength work, intensity judged by the talk test. It may be skipped for time only if made up next session.",
    minHoursBetweenHeavy: 48,
  });
}

export function upperLowerStructure(): ProgramStructure {
  const sessionTypes: Record<string, { label: string; focus: string; exercisePool: string[] }> = {};

  for (const id of CYCLE_ORDER) {
    const template = TEMPLATES[id];
    const exerciseSet = new Set<string>();

    for (const slot of template.slots) {
      if (slot.fixed) {
        exerciseSet.add(slot.fixed);
      }
      if (slot.examples) {
        for (const ex of slot.examples) {
          exerciseSet.add(ex);
        }
      }
    }

    sessionTypes[id] = {
      label: template.label,
      focus: template.slots.map(s => s.label).join("; "),
      exercisePool: Array.from(exerciseSet),
    };
  }

  return ProgramStructure.parse({
    phase: "upper_lower_4day",
    description: "Four-day Upper/Lower split cycling Upper A, Lower A, Upper B, Lower B.",
    rotation: CYCLE_ORDER as any,
    sessionTypes,
    progression: PHILOSOPHY.load.join(" "),
    conditioning: "Every upper session ends with a conditioning finisher (carries or ropes); lower sessions end with a sled or carry finisher.",
    minHoursBetweenHeavy: 48,
  });
}
