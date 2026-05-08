export type TemplateId = "upper_a" | "lower_a" | "upper_b" | "lower_b";

export interface TemplateSlot {
  id: string;
  label: string;
  sets: number;
  fixed?: string;
  examples?: string[];
  notes?: string;
}

export interface Template {
  id: TemplateId;
  label: string;
  slots: TemplateSlot[];
}

export const CYCLE_ORDER: TemplateId[] = ["upper_a", "lower_a", "upper_b", "lower_b"];

export const TEMPLATES: Record<TemplateId, Template> = {
  upper_a: {
    id: "upper_a",
    label: "Upper A",
    slots: [
      {
        id: "flat_bench",
        label: "Flat Barbell Bench Press",
        sets: 4,
        fixed: "Flat Barbell Bench Press",
        notes: "Always flat barbell bench — the anchor of Upper A",
      },
      {
        id: "primary_back",
        label: "Primary Back",
        sets: 4,
        examples: ["Barbell Row", "T-Bar Row", "Weighted Pull-ups", "Chest-Supported Row"],
      },
      {
        id: "horizontal_row",
        label: "Horizontal Row",
        sets: 3,
        examples: ["Cable Seated Row", "Dumbbell Row", "Machine Row", "Landmine Row"],
      },
      {
        id: "shoulder",
        label: "Shoulder",
        sets: 3,
        examples: ["Lateral Raises", "Arnold Press", "Cable Lateral Raise", "Face Pulls"],
      },
      {
        id: "bicep",
        label: "Bicep",
        sets: 3,
        examples: ["Barbell Curl", "Hammer Curl", "Incline Dumbbell Curl", "Cable Curl"],
      },
      {
        id: "tricep",
        label: "Tricep",
        sets: 3,
        examples: ["Skull Crushers", "Tricep Pushdown", "Overhead Cable Extension", "Close-Grip Bench"],
      },
    ],
  },

  lower_a: {
    id: "lower_a",
    label: "Lower A",
    slots: [
      {
        id: "primary_leg",
        label: "Primary Leg Compound",
        sets: 4,
        examples: ["Squat", "Leg Press", "Front Squat", "Hack Squat"],
        notes: "Must differ from Lower B primary leg. At high body weight, leg press may be preferred over barbell squat.",
      },
      {
        id: "hip_hinge",
        label: "Hip Hinge / Posterior Chain",
        sets: 4,
        examples: ["Romanian Deadlift", "Good Mornings", "Hip Thrust", "Cable Pull-Through"],
        notes: "Must differ from Lower B hip hinge",
      },
      {
        id: "supplemental_1",
        label: "Supplemental Lower 1",
        sets: 3,
        examples: ["Leg Curl", "Calf Raise", "Hip Abduction", "Leg Extension"],
      },
      {
        id: "supplemental_2",
        label: "Supplemental Lower 2",
        sets: 3,
        examples: ["Seated Calf Raise", "Glute Bridge", "Adductor Machine", "Single-Leg Press"],
      },
      {
        id: "finisher",
        label: "Explosive Dynamic Finisher",
        sets: 1,
        examples: ["Sled Push", "Sled Pull", "Walking Lunges", "Farmer Carries"],
        notes: "High-intensity finisher for mobility and conditioning",
      },
    ],
  },

  upper_b: {
    id: "upper_b",
    label: "Upper B",
    slots: [
      {
        id: "shoulder",
        label: "Primary Shoulder",
        sets: 4,
        examples: ["Seated Dumbbell Shoulder Press", "Overhead Press", "Push Press", "Machine Shoulder Press"],
        notes: "Seated preferred for lower back support at higher body weight",
      },
      {
        id: "bicep",
        label: "Primary Bicep",
        sets: 4,
        examples: ["Barbell Curl", "Preacher Curl", "Cable Curl", "Incline Dumbbell Curl"],
      },
      {
        id: "tricep",
        label: "Primary Tricep",
        sets: 4,
        examples: ["Close-Grip Bench Press", "Weighted Dips", "Skull Crushers", "Tricep Pushdown"],
      },
      {
        id: "chest_supp",
        label: "Supplemental Chest",
        sets: 3,
        examples: ["Incline Dumbbell Press", "Decline Press", "Cable Flys", "Pec Deck", "Dumbbell Flys"],
      },
      {
        id: "back_supp",
        label: "Supplemental Back",
        sets: 3,
        examples: ["Lat Pulldown", "Face Pulls", "Cable Pullover", "Straight-Arm Pulldown"],
      },
      {
        id: "upper_supp",
        label: "Additional Upper Body",
        sets: 3,
        examples: ["Rear Delt Fly", "Shrugs", "Upright Row", "Cable Crossover"],
      },
    ],
  },

  lower_b: {
    id: "lower_b",
    label: "Lower B",
    slots: [
      {
        id: "primary_leg",
        label: "Primary Leg Compound",
        sets: 4,
        examples: ["Deadlift", "Romanian Deadlift", "Leg Press (heavy)", "Trap Bar Deadlift"],
        notes: "Must differ from Lower A primary leg",
      },
      {
        id: "hip_hinge",
        label: "Hip Hinge / Posterior Chain",
        sets: 4,
        examples: ["Barbell Hip Thrust", "Glute-Ham Raise", "Nordic Curl", "Back Extension"],
        notes: "Must differ from Lower A hip hinge",
      },
      {
        id: "supplemental_1",
        label: "Supplemental Lower 1",
        sets: 3,
        examples: ["Bulgarian Split Squat", "Leg Extension", "Step-Ups", "Lateral Lunge"],
      },
      {
        id: "supplemental_2",
        label: "Supplemental Lower 2",
        sets: 3,
        examples: ["Standing Calf Raise", "Tibialis Raise", "Adductor Machine", "Banded Clamshells"],
      },
      {
        id: "finisher",
        label: "Explosive Dynamic Finisher",
        sets: 1,
        examples: ["Sled Push", "Sled Pull", "Walking Lunges", "Farmer Carries"],
        notes: "Rotate through options — avoid repeating the same finisher consecutively",
      },
    ],
  },
};

export function getNextTemplate(current: TemplateId): TemplateId {
  const idx = CYCLE_ORDER.indexOf(current);
  return CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
}

export function templateLabel(id: TemplateId): string {
  return TEMPLATES[id].label;
}

export const TEMPLATE_COLORS: Record<TemplateId, string> = {
  upper_a: "bg-[#1a0a0a] text-[#f87171]",
  lower_a: "bg-[#0a1a0a] text-[#86efac]",
  upper_b: "bg-[#110a1a] text-[#c4b5fd]",
  lower_b: "bg-[#1a1000] text-[#fdba74]",
};
