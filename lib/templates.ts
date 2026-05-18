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
        id: "primary_chest",
        label: "Primary Chest",
        sets: 4,
        fixed: "Flat Barbell Bench Press",
        notes: "Always flat barbell bench — the anchor of Upper A",
      },
      {
        id: "primary_back",
        label: "Primary Back",
        sets: 4,
        examples: ["Barbell Row", "T-Bar Row", "Weighted Pull-ups", "Chest-Supported Row", "Iso-Lateral Row", "Iso-Lateral High Row"],
      },
      {
        id: "supp_shoulder",
        label: "Supplemental Shoulder",
        sets: 3,
        examples: ["Lateral Raises", "Cable Lateral Raise", "Face Pulls", "Rear Delt Fly", "Upright Row"],
        notes: "Accessory shoulder work — not a heavy press",
      },
      {
        id: "supp_bicep",
        label: "Supplemental Bicep",
        sets: 3,
        examples: ["Barbell Curl", "EZ Bar Curl", "Hammer Curl", "Incline Dumbbell Curl", "Cable Curl", "MTS Bicep Curl"],
      },
      {
        id: "supp_tricep",
        label: "Supplemental Tricep",
        sets: 3,
        examples: ["Skull Crushers", "Tricep Pushdown", "Overhead Cable Extension", "MTS Tricep Extension", "Seated Dip Machine"],
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
        examples: ["Barbell Squat", "Leg Press Machine", "Hack Squat Machine", "Smith Machine Squat"],
        notes: "Must differ from Lower B primary leg. At high body weight, Leg Press Machine or Hack Squat Machine may be preferred over barbell squat.",
      },
      {
        id: "hip_hinge",
        label: "Hip Hinge / Posterior Chain",
        sets: 4,
        examples: ["Romanian Deadlift", "Good Mornings", "Barbell Hip Thrust", "Cable Pull-Through", "Seated Cable Row (low, hip-hinge focus)"],
        notes: "Must differ from Lower B hip hinge",
      },
      {
        id: "supplemental_1",
        label: "Supplemental Lower 1",
        sets: 3,
        examples: ["Leg Curl Machine", "Leg Extension Machine", "Hip Abduction / Adduction Machine", "Calf Raise"],
      },
      {
        id: "supplemental_2",
        label: "Supplemental Lower 2",
        sets: 3,
        examples: ["Seated Calf Raise", "Glute Bridge", "Hip Abduction / Adduction Machine", "Single-Leg Press Machine"],
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
        examples: ["Seated Dumbbell Shoulder Press", "Overhead Barbell Press", "Plate-Loaded Shoulder Press", "Cable Shoulder Press"],
        notes: "Seated preferred for lower back support at higher body weight",
      },
      {
        id: "bicep",
        label: "Primary Bicep",
        sets: 4,
        examples: ["Barbell Curl", "EZ Bar Curl", "Preacher Curl", "MTS Bicep Curl", "Incline Dumbbell Curl"],
      },
      {
        id: "tricep",
        label: "Primary Tricep",
        sets: 4,
        examples: ["Close-Grip Bench Press", "Skull Crushers", "MTS Tricep Extension", "Seated Dip Machine", "Tricep Pushdown"],
      },
      {
        id: "chest_supp",
        label: "Supplemental Chest",
        sets: 3,
        examples: ["Iso-Lateral Incline Press", "Iso-Lateral Decline Press", "Iso-Lateral Bench Press", "Iso-Lateral Wide Press", "Cable Chest Press", "Plate-Loaded Chest Press", "Pec Deck", "Incline Dumbbell Press"],
      },
      {
        id: "back_supp",
        label: "Supplemental Back",
        sets: 3,
        examples: ["Lat Pulldown Machine", "MTS Front Pulldown", "Iso-Lateral Wide Pulldown", "Iso-Lateral Front Lat Pulldown", "Pullover Machine", "Straight-Arm Pulldown"],
      },
      {
        id: "upper_supp",
        label: "Additional Upper Body",
        sets: 3,
        examples: ["Rear Delt Fly", "Shrugs", "Upright Row", "Cable Crossover", "Face Pulls"],
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
        examples: ["Deadlift", "Trap Bar Deadlift", "Leg Press Machine (heavy)", "Romanian Deadlift"],
        notes: "Must differ from Lower A primary leg",
      },
      {
        id: "hip_hinge",
        label: "Hip Hinge / Posterior Chain",
        sets: 4,
        examples: ["Barbell Hip Thrust", "Glute-Ham Raise", "Nordic Curl", "Back Extension", "Cable Pull-Through"],
        notes: "Must differ from Lower A hip hinge",
      },
      {
        id: "supplemental_1",
        label: "Supplemental Lower 1",
        sets: 3,
        examples: ["Bulgarian Split Squat", "Leg Extension Machine", "Step-Ups", "Lateral Lunge", "Leg Curl Machine"],
      },
      {
        id: "supplemental_2",
        label: "Supplemental Lower 2",
        sets: 3,
        examples: ["Standing Calf Raise", "Hip Abduction / Adduction Machine", "Tibialis Raise", "Banded Clamshells"],
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
