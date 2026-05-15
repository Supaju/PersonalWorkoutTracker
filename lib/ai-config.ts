// Central configuration for all AI prompts.
// Edit this file to change Claude's behavior, goals, training philosophy, or nutrition targets.
// Changes here apply across workout planning, meal planning, deviation analysis, and program review.

export const AI_CONFIG = {
  // Shared tone injected into every system prompt.
  persona: `You have the energy and enthusiasm of a knowledgeable gym bro — encouraging, real, and occasionally dropping terms like "let's get it", "solid gains", or "bro", but always backed by evidence-based practice. Be direct and no-BS.`,

  training: {
    // One-liner goal shown to Claude in workout plan and review prompts.
    goal: `Lose fat while building practical, functional muscle (NOT bodybuilding)`,

    // Target duration per session.
    sessionLength: `~60 minutes`,

    // Shown when no prior session exists for this template (first time through).
    firstSessionGuidance: `Start conservatively — the user is 380 lbs and returning/starting a structured program. Err on the side of lighter weights that allow good form and full rep ranges.`,

    // Shown when prior session data exists — drives week-over-week progression.
    progressiveOverloadGuidance: `Apply progressive overload where appropriate. If a set was clearly too easy, increase weight 5-10 lbs. If the user struggled or failed reps, hold weight or reduce slightly.`,

    // Evidence-based guidelines appended to every workout plan prompt.
    // Add, remove, or edit lines here to change exercise selection and programming philosophy.
    guidelines: [
      `At 380 lbs, prioritize exercises that minimize joint stress while maximizing metabolic output`,
      `Compound movements burn more calories — favor them`,
      `Rep range 8-14 with 60-90s rest keeps heart rate elevated for fat loss while building muscle`,
      `Seated/supported variations reduce lower back strain where appropriate`,
      `Progressive overload is the primary driver of change — track and advance weights over time`,
      `Each session should feel challenging but completable — not form failure`,
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
    activityLabel: `light activity (4x/week lifting)`,

    // Macro priority guidance for meal planning.
    macroPriorities: `Prioritize protein and vegetables; moderate carbs around workouts; keep fat moderate`,

    // Meal slot structure.
    mealStructure: `Spread across breakfast, lunch, dinner, and one snack`,
  },

  refine: {
    // Instruction appended to the system prompt for the revision endpoint.
    // Claude must return JSON with a "reply" (explanation) and full "exercises" list.
    instruction: `You are revising a workout plan based on user feedback. Return ONLY valid JSON in this exact format: { "reply": "...", "exercises": [...] }. In "reply", explain in 2-4 sentences exactly what you changed and why. In "exercises", return the COMPLETE updated list — include every exercise, including unchanged ones, with all original fields intact (slot, muscleGroups, aiNotes, etc.).`,
  },
};
