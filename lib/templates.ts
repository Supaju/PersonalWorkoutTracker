export type TemplateId = "upper_a" | "lower_a" | "upper_b" | "lower_b";

export interface TemplateSlot {
  id: string;
  label: string;
  sets: number;
  targetReps?: string;
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
    // Horizontal push + horizontal pull anchors. Overhead press as third movement.
    // Shoulder health, core, and conditioning finisher complete the 6-slot structure.
    slots: [
      {
        id: "primary_chest",
        label: "Primary Chest — Horizontal Push",
        sets: 4,
        targetReps: "6-10",
        fixed: "Flat Barbell Bench Press",
        notes: "Fixed anchor of Upper A. Primary strength marker — chase a 5 lb increase every 2-3 weeks via double progression. Never program to failure.",
      },
      {
        id: "primary_back",
        label: "Primary Back — Horizontal Pull",
        sets: 4,
        targetReps: "8-12",
        examples: ["Barbell Row", "Chest-Supported Row", "T-Bar Row", "Iso-Lateral Row", "Iso-Lateral High Row"],
        notes: "Horizontal pull to directly counterbalance bench press. Chest-Supported Row preferred when lower back is fatigued from a recent lower session.",
      },
      {
        id: "overhead_press",
        label: "Overhead Press — Vertical Push",
        sets: 3,
        targetReps: "10-14",
        examples: ["Seated Dumbbell Overhead Press", "Plate-Loaded Shoulder Press Machine", "Cable Shoulder Press"],
        notes: "Seated preferred for lower back support at this body weight. Use the same weight as Upper B primary overhead press. This is the accessory exposure — Upper B is where OHP is trained as the primary strength movement.",
      },
      {
        id: "supp_shoulder",
        label: "Shoulder Health",
        sets: 3,
        targetReps: "15-20",
        examples: ["Face Pull", "Rear Delt Cable Fly", "Reverse Pec Deck", "Rear Delt Machine", "Band Pull-Apart"],
        notes: "Non-negotiable slot. Heavy pressing volume at high body weight chronically undertreins the posterior shoulder and rotator cuff. High rep range drives blood flow and connective tissue health. Do NOT substitute a bicep or tricep exercise here.",
      },
      {
        id: "core",
        label: "Core — Anti-Extension",
        sets: 3,
        targetReps: "10 each side",
        examples: ["Dead Bug", "Ab Rollout from Knees", "Pallof Press", "Bird Dog"],
        notes: "Anti-extension core stability. Rotate selection — do not repeat the same exercise used in Upper B's core slot this cycle. Dead Bug is the default. Progress by extending the range of motion over weeks.",
      },
      {
        id: "finisher",
        label: "Conditioning Finisher",
        sets: 3,
        examples: ["Farmer Carries", "Suitcase Carry (alternating sides)", "Battle Ropes 30s on / 30s off"],
        notes: "3 rounds at challenging load with full rest between rounds. Every upper session ends with a conditioning finisher — this is not optional. Builds grip, core, shoulders, and cardiovascular capacity simultaneously. Increase carry weight every 2-3 weeks.",
      },
    ],
  },

  lower_a: {
    id: "lower_a",
    label: "Lower A",
    // Squat-pattern primary + RDL hip hinge. Hamstring and hip stability accessories.
    // Core and sled finisher complete the 6-slot structure.
    slots: [
      {
        id: "primary_leg",
        label: "Primary Leg Compound — Squat Pattern",
        sets: 4,
        targetReps: "8-12",
        examples: ["Hack Squat Machine", "Leg Press Machine", "Smith Machine Squat"],
        notes: "Must differ from Lower B primary leg. Machine variations preferred over barbell back squat at this body weight — they reduce lower back shear while preserving full quad and glute stimulus. Rotate options across cycles.",
      },
      {
        id: "hip_hinge",
        label: "Hip Hinge — Posterior Chain",
        sets: 4,
        targetReps: "10-14",
        examples: ["Romanian Deadlift", "Good Mornings", "Cable Pull-Through"],
        notes: "Must differ from Lower B hip hinge. Romanian Deadlift is the default — it builds the posterior chain pattern essential for safe lifting in daily life. Avoid Barbell Hip Thrust here — that belongs on Lower B.",
      },
      {
        id: "hamstring",
        label: "Hamstring Supplemental — Knee Flexion",
        sets: 3,
        targetReps: "12-15",
        examples: ["Leg Curl Machine", "Single-Leg Curl Machine", "Nordic Curl (advanced)"],
        notes: "Knee-flexion hamstring work to complement the hip-hinge-dominant RDL. The RDL trains the hamstring in a lengthened position — the leg curl trains the shortened position. Both are needed for full development and injury prevention.",
      },
      {
        id: "hip_stability",
        label: "Hip Stability — Glute Medius",
        sets: 3,
        targetReps: "15-20",
        examples: ["Hip Abduction Machine", "Hip Adduction Machine", "Glute Bridge", "Banded Clamshell"],
        notes: "Glute medius and hip stabilizer work. Critical at high body weight for knee tracking under load and hip stability during walking. Alternate hip abduction and adduction across Lower A sessions.",
      },
      {
        id: "core",
        label: "Core — Direct Loading",
        sets: 3,
        targetReps: "12-15",
        examples: ["Cable Crunch", "Ab Rollout from Knees", "Hanging Knee Raise"],
        notes: "Direct anterior core loading. Cable Crunch is the default — it allows progressive overload (add weight over time) unlike bodyweight crunches. Treat it like any other exercise: chase reps, then add weight.",
      },
      {
        id: "finisher",
        label: "Conditioning Finisher",
        sets: 3,
        examples: ["Sled Push", "Sled Pull", "Walking Lunges (length of gym)", "Farmer Carries"],
        notes: "3 max-effort rounds with full rest between. Sled Push is preferred after heavy squat and hinge work — no eccentric loading means no next-day soreness penalty. Rotate finisher options — do not repeat the same option as the previous lower session.",
      },
    ],
  },

  upper_b: {
    id: "upper_b",
    label: "Upper B",
    // Vertical push (OHP) + vertical pull (lat pulldown) are the two primaries.
    // Upper A = horizontal push/pull. Upper B = vertical push/pull.
    // Together they cover all four major upper body movement patterns across the cycle.
    // No dedicated bicep or tricep slot — arms are trained indirectly by all pressing and pulling.
    slots: [
      {
        id: "shoulder",
        label: "Primary Overhead Press — Vertical Push",
        sets: 4,
        targetReps: "6-10",
        examples: ["Seated Dumbbell Overhead Press", "Overhead Barbell Press", "Plate-Loaded Shoulder Press Machine"],
        notes: "Primary strength anchor of Upper B. Track and progress this exactly like the bench press on Upper A. Seated preferred for lower back support at this body weight. Do NOT program bicep curls or tricep pushdowns in this slot.",
      },
      {
        id: "primary_pull",
        label: "Primary Pull — Vertical Pull",
        sets: 4,
        targetReps: "8-12",
        examples: ["Lat Pulldown Machine", "Iso-Lateral Front Pulldown", "MTS Front Pulldown", "Cable Pulldown"],
        notes: "Vertical pull to directly pair with the overhead press. Upper B is the vertical push/pull day. Lat Pulldown is the default. Biceps receive significant indirect work here — no additional bicep isolation needed.",
      },
      {
        id: "chest_supp",
        label: "Secondary Chest — Incline Press",
        sets: 3,
        targetReps: "10-14",
        examples: ["Iso-Lateral Incline Press", "Incline Dumbbell Press", "Cable Incline Press", "Plate-Loaded Incline Press"],
        notes: "Secondary chest stimulus at a different angle than flat bench on Upper A. Machine or cable variations preferred — you are already fatigued from heavy overhead pressing. Triceps receive significant indirect work here.",
      },
      {
        id: "back_supp",
        label: "Secondary Pull — Horizontal Pull",
        sets: 3,
        targetReps: "12-15",
        examples: ["Chest-Supported Row", "Iso-Lateral Row", "Seated Cable Row", "Iso-Lateral High Row"],
        notes: "Horizontal pull to complement the vertical lat pulldown. Use a different grip width or machine from whatever was chosen on Upper A's primary back slot. Provides additional mid-back volume for posture and pulling strength.",
      },
      {
        id: "core",
        label: "Core — Anti-Rotation",
        sets: 3,
        targetReps: "10 each side",
        examples: ["Pallof Press", "Landmine Rotation", "Side Plank (timed hold)", "Bird Dog"],
        notes: "Anti-rotation core stability — different movement pattern from Upper A's anti-extension core. Pallof Press is the default. Rotate selection — do not repeat the same exercise used in Upper A's core slot this cycle.",
      },
      {
        id: "finisher",
        label: "Conditioning Finisher",
        sets: 3,
        examples: ["Farmer Carries", "Suitcase Carry (alternating sides)", "Battle Ropes 30s on / 30s off"],
        notes: "3 rounds at challenging load with full rest between rounds. Every upper session ends with a conditioning finisher. Increase carry weight or rope intensity every 2-3 weeks.",
      },
    ],
  },

  lower_b: {
    id: "lower_b",
    label: "Lower B",
    // Trap bar deadlift + hip thrust as the two primaries.
    // Quad supplemental + unilateral leg for balance. Core and sled finisher complete the 6 slots.
    slots: [
      {
        id: "primary_leg",
        label: "Primary Leg Compound — Hip Hinge / Pull",
        sets: 4,
        targetReps: "5-8",
        examples: ["Trap Bar Deadlift", "Leg Press Machine (heavy)", "Conventional Deadlift"],
        notes: "Trap Bar Deadlift is the explicit first choice — load stays centered, torso stays more upright, lumbar shear stress is dramatically lower than conventional deadlift. Conventional Deadlift is a future goal as body weight decreases and hip mobility improves. Must differ from Lower A primary leg.",
      },
      {
        id: "hip_hinge",
        label: "Hip Hinge — Glute Focus",
        sets: 4,
        targetReps: "10-14",
        examples: ["Barbell Hip Thrust", "Machine Hip Thrust", "Back Extension", "Glute-Ham Raise"],
        notes: "Glute-dominant posterior chain work. Hip Thrust produces the highest glute activation of any lower body exercise — program it first before other options. Must differ from Lower A hip hinge (which is RDL-focused).",
      },
      {
        id: "quad_supp",
        label: "Quad Supplemental — Knee Extension",
        sets: 3,
        targetReps: "12-15",
        examples: ["Leg Extension Machine", "Step-Ups with Dumbbells", "Sissy Squat (advanced)"],
        notes: "Lower B is hinge-dominant (trap bar + hip thrust). The leg extension brings the quad back into balance without adding compressive knee load from a squat pattern. Knee extensor strength supports stair climbing and incline walking.",
      },
      {
        id: "unilateral",
        label: "Unilateral Leg — Single-Leg Work",
        sets: 3,
        targetReps: "10-12 each leg",
        examples: ["Single-Leg Press Machine", "Reverse Lunge", "Step-Up with load", "Split Squat (Machine)"],
        notes: "Every real-world movement is unilateral. Single-leg work exposes and corrects left-right imbalances invisible in bilateral exercises — these compound over time at high body weight and lead to injury. Load conservatively — balance is a skill that improves with practice.",
      },
      {
        id: "core",
        label: "Core — Lumbar Stability",
        sets: 3,
        targetReps: "10 each side",
        examples: ["Bird Dog", "Ab Rollout from Knees", "Plank Hold (30-45 sec)", "Cable Crunch"],
        notes: "Bird Dog is the default — trains deep lumbar stabilizers in the contralateral pattern demanded by the trap bar deadlift and hip thrust. Alternate with a different exercise from Lower A's core selection each cycle.",
      },
      {
        id: "finisher",
        label: "Conditioning Finisher",
        sets: 3,
        examples: ["Sled Push", "Sled Pull", "Farmer Carries", "Walking Lunges (length of gym)"],
        notes: "3 max-effort rounds with full rest between. Rotate finisher — do not repeat the same option as the previous lower session. Sled Push is preferred after heavy deadlift work — no eccentric means no soreness penalty on top of the heavy pull.",
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
