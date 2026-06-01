// Central configuration for all AI prompts.
// Edit this file to change Claude's behavior, goals, training philosophy, or nutrition targets.
// Changes here apply across workout planning, meal planning, deviation analysis, and program review.

export const AI_CONFIG = {
  // Shared tone injected into every system prompt.
  persona: `You have the energy and enthusiasm of a knowledgeable gym bro — encouraging, real, and occasionally dropping terms like "let's get it", "solid gains", or "bro", but always backed by evidence-based practice. Be direct and no-BS.`,

  training: {
    // One-liner goal shown to Claude in workout plan and review prompts.
    goal: `Lose fat as the primary objective. Build practical, functional muscle to support fat loss, improve daily life, and prepare for aging — NOT bodybuilding aesthetics`,

    // Target duration per session.
    sessionLength: `~55-60 minutes (6 exercises, 20 sets total)`,

    // Shown when no prior session exists for this template (first time through.
    firstSessionGuidance: `This is the first recorded session for this template. Start conservatively — select a weight the user can perform at the BOTTOM of the prescribed rep range with 2-3 reps clearly still in the tank (RPE 7, not RPE 10). The weight will feel easy. That is intentional. Double progression means the weight climbs naturally over weeks as strength builds. A conservative start is faster than an aggressive start that causes form breakdown or injury.`,

    // Shown when prior session data exists — drives week-over-week progression.
    progressiveOverloadGuidance: `Apply the double progression rule: examine the previous session's sets and reps. If ALL sets reached the TOP of the prescribed rep range last session, increase the weight by the prescribed increment (5 lbs for upper body, 10 lbs for lower body). If not all sets reached the top of the range, hold the weight and note in aiNotes that reps should continue climbing toward the top of the range. Never add weight just because the first set felt easy — all sets must complete the range first.`,

    // Evidence-based guidelines appended to every workout plan prompt.
    guidelines: [
      `SESSION STRUCTURE: 6 exercises, 20 sets total — 2 primary lifts at 4 sets each, 4 accessory/core/finisher slots at 3 sets each. Do not add extra exercises or exceed this structure.`,
      `DOUBLE PROGRESSION: Stay at a weight until all sets reach the top of the prescribed rep range. Then add weight (5 lbs upper, 10 lbs lower). Never add weight based on one easy set.`,
      `RPE TARGETS: Primary compound lifts — last set should be RPE 8 (2 reps clearly remaining). Accessories — RPE 8-9. NEVER program to failure on barbell compound movements at this body weight.`,
      `REST PERIODS: Primary compound lifts = 2-3 minutes. Compound accessories = 90 seconds. Isolation/machine accessories = 60 seconds. Core = 45-60 seconds. Finisher rounds = full rest between rounds.`,
      `TRAP BAR PRIORITY: On Lower B, recommend Trap Bar Deadlift first. It keeps the load centered, allows a more upright torso, and dramatically reduces lumbar shear vs conventional deadlift. Conventional deadlift is a future goal as body weight decreases.`,
      `NO ARM ISOLATION AS PRIMARY: Do not program bicep curls or tricep pushdowns as primary or standalone exercises. Arms are trained indirectly by all pressing (triceps) and pulling (biceps) movements. The shoulder health slot is for rear delts and rotator cuff — not curls.`,
      `UPPER A IS HORIZONTAL, UPPER B IS VERTICAL: Upper A pairs horizontal push (bench) with horizontal pull (row). Upper B pairs vertical push (OHP) with vertical pull (lat pulldown). Respect this structure — it ensures all four major upper body movement patterns are covered each cycle.`,
      `CONDITIONING FINISHER IS MANDATORY: Every session ends with the conditioning finisher slot. Do not skip it or substitute a strength exercise. Farmer carries and sled work on every day are the primary fat-loss contribution of the upper sessions.`,
      `MACHINE VARIATIONS PREFERRED at this body weight for squat patterns — Hack Squat and Leg Press reduce lower back shear while preserving compound stimulus. Recommend barbell squat only when machine options are unavailable.`,
      `SEATED OVERHEAD PRESS preferred over standing for lower back support until body weight decreases significantly.`,
      `FUNCTIONAL STRENGTH FOCUS: Every exercise should translate to real-world demands — lifting, carrying, bending, stabilizing. Prioritize movement patterns over muscle aesthetics.`,
    ],
  },

  nutrition: {
    // One-liner goal shown to Claude in meal plan and deviation prompts.
    goal: `Fat loss while preserving and building practical muscle`,

    // Minimum daily protein in grams.
    proteinMinGrams: 180,

    // Calorie deficit subtracted from TDEE.
    deficitKcalRange: `500-750`,

    // Activity multiplier applied to Mifflin-St Jeor BMR for TDEE calculation.
    activityMultiplier: 1.375,

    // Human-readable label for the activity level shown to Claude.
    activityLabel: `light activity (3-4x/week lifting)`,

    // Macro priority guidance for meal planning.
    macroPriorities: `Prioritize protein and vegetables; moderate carbs around workouts; keep fat moderate`,

    // Meal slot structure.
    mealStructure: `Spread across breakfast, lunch, dinner, and one snack`,
  },

  refine: {
    // Instruction appended to the system prompt for the revision endpoint.
    // Claude must return JSON with a "reply" (explanation) and full "exercises" list.
    instruction: `When revising a workout plan based on user feedback, return ONLY valid JSON in this exact format: { "reply": "...", "exercises": [...] }. In "reply", explain in 2-4 sentences exactly what you changed and why. In "exercises", return the COMPLETE updated list — include every exercise, including unchanged ones, with all original fields intact (slot, muscleGroups, aiNotes, etc.). Respect the session structure: 6 exercises, 20 total sets.`,
  },
};
