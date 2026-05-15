import Anthropic from "@anthropic-ai/sdk";
import type { UserProfile, Equipment, FoodItem, MealPlan, SessionExercise, SetLog, WorkoutSession } from "@prisma/client";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import { AI_CONFIG } from "@/lib/ai-config";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function formatHeight(totalInches: number): string {
  const ft = Math.floor(totalInches / 12);
  const inch = Math.round(totalInches % 12);
  return `${ft}'${inch}"`;
}

type SessionWithExercises = WorkoutSession & {
  exercises: (SessionExercise & { sets: SetLog[] })[];
};

export function buildPlanPrompt(data: {
  profile: UserProfile;
  equipment: Equipment[];
  template: TemplateId;
  lastSameSession: SessionWithExercises | null;
  lastAlternateLowerSession: SessionWithExercises | null;
}): { system: string; user: string } {
  const { profile, equipment, template, lastSameSession, lastAlternateLowerSession } = data;
  const tmpl = TEMPLATES[template];

  const equipmentList =
    equipment.length > 0
      ? equipment.map((e) => `- ${e.name} (${e.category})`).join("\n")
      : "No equipment specified — assume standard commercial gym.";

  const formatSession = (s: SessionWithExercises) =>
    s.exercises
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((ex) => {
        const setLines =
          ex.sets.length > 0
            ? ex.sets.map((st) => `    Set ${st.setNumber}: ${st.weightLbs} lbs × ${st.reps} reps`).join("\n")
            : "    (no sets logged)";
        return `  ${ex.name} (${ex.slot}) — target ${ex.targetSets}×${ex.targetReps}\n${setLines}`;
      })
      .join("\n\n");

  const historySection = lastSameSession
    ? `LAST ${tmpl.label.toUpperCase()} SESSION (${lastSameSession.date}):\n${formatSession(lastSameSession)}\n\n${AI_CONFIG.training.progressiveOverloadGuidance}`
    : `No previous ${tmpl.label} sessions recorded. This is the first time. ${AI_CONFIG.training.firstSessionGuidance}`;

  const alternateLowerNote =
    (template === "lower_a" || template === "lower_b") && lastAlternateLowerSession
      ? `\nIMPORTANT — AVOID THESE FROM THE ALTERNATE LOWER SESSION (${lastAlternateLowerSession.date}):\n${lastAlternateLowerSession.exercises
          .filter((e) => e.slot === "primary_leg" || e.slot === "hip_hinge")
          .map((e) => `  ${e.slot}: ${e.name}`)
          .join("\n")}\nDo NOT repeat the same primary leg exercise or hip hinge as above.`
      : "";

  const slotDescriptions = tmpl.slots
    .map((s) => {
      const examples = s.examples ? `Options: ${s.examples.join(", ")}` : "";
      const fixed = s.fixed ? `FIXED: Always "${s.fixed}"` : "";
      const note = s.notes ? `Note: ${s.notes}` : "";
      return `  • ${s.label} — ${s.sets} sets\n    ${fixed || examples}\n    ${note}`.trim();
    })
    .join("\n\n");

  const guidelinesList = AI_CONFIG.training.guidelines.map((g) => `- ${g}`).join("\n");

  return {
    system: `You are an expert personal trainer and exercise scientist. ${AI_CONFIG.persona}`,
    user: `Design a ${tmpl.label} workout for this specific person.

USER PROFILE:
- Age: ${profile.age}, Gender: ${profile.gender}
- Height: ${formatHeight(profile.heightIn)}, Weight: ${profile.weightLbs} lbs
- Goal: ${AI_CONFIG.training.goal}
- Target session length: ${AI_CONFIG.training.sessionLength}

AVAILABLE EQUIPMENT:
${equipmentList}

${tmpl.label.toUpperCase()} TEMPLATE STRUCTURE:
${slotDescriptions}

${historySection}
${alternateLowerNote}

EVIDENCE-BASED GUIDELINES FOR THIS USER:
${guidelinesList}

Return ONLY valid JSON in this exact format (no markdown, no explanation outside the JSON):
{
  "sessionNotes": "2-3 sentence overview of this session's approach and any key coaching points",
  "exercises": [
    {
      "slot": "<slot id from template>",
      "name": "<specific exercise name>",
      "muscleGroups": "<primary muscles targeted>",
      "targetSets": <number>,
      "targetReps": "<e.g. 10-12>",
      "targetWeight": <starting weight in lbs, or null for bodyweight/machine with no standard weight>,
      "aiNotes": "<1-2 sentences: why this exercise, any form cues, or progressive overload note>"
    }
  ]
}`,
  };
}

// ---- Meal plan prompt ----

export function buildMealPlanPrompt(data: {
  profile: UserProfile;
  foodItems: FoodItem[];
  date: string;
}): { system: string; user: string } {
  const { profile, foodItems, date } = data;

  const foodList = foodItems
    .map(
      (f) =>
        `- ID:${f.id} | ${f.name}${f.serving ? ` (${f.serving})` : ""}: ${f.calories} kcal | ${f.protein}g protein | ${f.carbs}g carbs | ${f.fat}g fat`
    )
    .join("\n");

  return {
    system: `You are a sports nutritionist who knows macros and body composition inside out. ${AI_CONFIG.persona}`,
    user: `Create a daily meal plan. Use ONLY the foods listed below.

USER PROFILE:
- Age: ${profile.age}, Gender: ${profile.gender}
- Height: ${formatHeight(profile.heightIn)}, Weight: ${profile.weightLbs} lbs
- Goal: ${AI_CONFIG.nutrition.goal}

DATE: ${date}

NUTRITION TARGETS:
Calculate the user's TDEE using Mifflin-St Jeor (convert lbs to kg, inches to cm), apply a ${AI_CONFIG.nutrition.activityLabel} multiplier (${AI_CONFIG.nutrition.activityMultiplier}), then subtract ${AI_CONFIG.nutrition.deficitKcalRange} kcal for a fat loss deficit.
- Protein target: minimum ${AI_CONFIG.nutrition.proteinMinGrams}g/day (critical for muscle preservation during fat loss)
- ${AI_CONFIG.nutrition.macroPriorities}
- ${AI_CONFIG.nutrition.mealStructure}

AVAILABLE FOODS (use the exact IDs):
${foodList}

Return ONLY valid JSON in this exact format:
{
  "planNotes": "2-3 sentences: calorie target, macro breakdown, and key reasoning",
  "estimatedCalories": <number>,
  "estimatedProtein": <number>,
  "estimatedCarbs": <number>,
  "estimatedFat": <number>,
  "meals": [
    {
      "slot": "breakfast",
      "items": [
        { "foodItemId": "<exact ID from list>", "quantity": <number>, "notes": "<optional serving note>" }
      ]
    },
    { "slot": "lunch", "items": [...] },
    { "slot": "dinner", "items": [...] },
    { "slot": "snack", "items": [...] }
  ]
}`,
  };
}

// ---- Deviation analysis prompt ----

export function buildDeviationPrompt(data: {
  profile: UserProfile;
  description: string;
  currentPlanTotals: { calories: number; protein: number; carbs: number; fat: number } | null;
  date: string;
}): { system: string; user: string } {
  const { profile, description, currentPlanTotals, date } = data;

  const planContext = currentPlanTotals
    ? `Their planned meals today already total: ${Math.round(currentPlanTotals.calories)} kcal | ${Math.round(currentPlanTotals.protein)}g protein | ${Math.round(currentPlanTotals.carbs)}g carbs | ${Math.round(currentPlanTotals.fat)}g fat`
    : "No meal plan has been logged yet for today.";

  return {
    system: `You are a sports nutritionist helping someone understand how their food choices fit their goals. ${AI_CONFIG.persona}`,
    user: `USER PROFILE:
- Age: ${profile.age}, Gender: ${profile.gender}
- Height: ${formatHeight(profile.heightIn)}, Weight: ${profile.weightLbs} lbs
- Goal: ${AI_CONFIG.nutrition.goal}
- Approximate daily calorie target: Calculate TDEE (Mifflin-St Jeor, ${AI_CONFIG.nutrition.activityLabel} ${AI_CONFIG.nutrition.activityMultiplier}) minus ${AI_CONFIG.nutrition.deficitKcalRange} kcal deficit

DATE: ${date}
${planContext}

WHAT THEY ATE (or plan to eat):
"${description}"

Please provide:

## Nutrition Estimate
Estimate the calories and macros for what they described. Be specific — break it down by item if multiple foods were mentioned.

## How It Fits Today
How does this fit into their daily targets? If they have a meal plan, account for it. Are they over/under on calories and protein?

## Course Correction
Give 2-3 specific, practical suggestions for what they should eat for the rest of the day to stay on track toward their goals. Be realistic — don't suggest they starve themselves.`,
  };
}

// ---- Review prompt ----

export function buildReviewPrompt(data: {
  profile: UserProfile;
  equipment: Equipment[];
  recentSessions: SessionWithExercises[];
  foodItems: FoodItem[];
  mealPlan: MealPlan | null;
  currentTemplate: TemplateId;
}): { system: string; user: string } {
  const { profile, equipment, recentSessions, foodItems, mealPlan, currentTemplate } = data;

  const equipmentSection =
    equipment.length > 0
      ? equipment.map((e) => `- ${e.name} (${e.category})`).join("\n")
      : "No equipment specified.";

  const sessionSection =
    recentSessions.length > 0
      ? recentSessions
          .map((s) => {
            const label = TEMPLATES[s.template as TemplateId]?.label ?? s.template;
            const exList = s.exercises
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((ex) => {
                const sets =
                  ex.sets.length > 0
                    ? ex.sets.map((st) => `${st.weightLbs}×${st.reps}`).join(", ")
                    : "no sets recorded";
                return `  - ${ex.name}: ${sets}`;
              })
              .join("\n");
            return `${label} (${s.date}, ${s.phase}):\n${exList}`;
          })
          .join("\n\n")
      : "No sessions recorded yet.";

  const foodSection =
    foodItems.length > 0
      ? foodItems
          .map(
            (f) =>
              `- ${f.name}${f.serving ? ` (${f.serving})` : ""}: ${f.calories} kcal | ${f.protein}g protein | ${f.carbs}g carbs | ${f.fat}g fat`
          )
          .join("\n")
      : "No food items added.";

  const mealSection = mealPlan ? `Today's meal plan:\n${mealPlan.meals}` : "No meal plan for today.";

  return {
    system: `You are a certified personal trainer and sports nutritionist reviewing a client's program. Be direct, specific, and constructive. ${AI_CONFIG.persona}`,
    user: `USER PROFILE:
- Age: ${profile.age}, Gender: ${profile.gender}
- Height: ${formatHeight(profile.heightIn)}, Weight: ${profile.weightLbs} lbs
- Goal: ${AI_CONFIG.training.goal}
- Current cycle position: ${TEMPLATES[currentTemplate]?.label ?? currentTemplate} is next

AVAILABLE EQUIPMENT:
${equipmentSection}

RECENT WORKOUT SESSIONS (last ${recentSessions.length}):
${sessionSection}

FOOD LIBRARY:
${foodSection}

${mealSection}

Review this program and provide structured feedback:

## Program Structure
Is the 4-day Upper A / Lower A / Upper B / Lower B rotation appropriate for this person's goals and current fitness level?

## Exercise Selection & Progressive Overload
Are the exercises well-chosen for fat loss + practical strength at this body weight? Is progressive overload being applied correctly across sessions?

## Nutrition
Are the food choices supporting fat loss while preserving muscle? Assess protein adequacy (target: ~${AI_CONFIG.nutrition.proteinMinGrams}g/day).

## Overall Recommendations
List 3–5 specific, actionable adjustments to improve results.`,
  };
}

// ---- Refine prompt ----

export function buildRefinePrompt(): string {
  return `You are an expert personal trainer and exercise scientist. ${AI_CONFIG.persona}\n\n${AI_CONFIG.refine.instruction}`;
}
