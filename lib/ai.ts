import Anthropic from "@anthropic-ai/sdk";
import type { UserProfile, Equipment, FoodItem, MealPlan, SessionExercise, SetLog, WorkoutSession, NutritionEntry } from "@prisma/client";
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
      const reps = s.targetReps ? `Target reps: ${s.targetReps}` : "";
      const note = s.notes ? `Note: ${s.notes}` : "";
      const setsLabel = `${s.sets} sets${s.targetReps ? ` × ${s.targetReps}` : ""}`;
      const parts = [fixed || examples, reps, note].filter(Boolean);
      return `  • ${s.label} — ${setsLabel}\n    ${parts.join("\n    ")}`.trim();
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

// ---- Nutrition chat prompt ----

export function buildNutritionChatPrompt(data: {
  profile: UserProfile;
  entries: NutritionEntry[];
  foodItems: FoodItem[];
  date: string;
}): { system: string } {
  const { profile, entries, foodItems, date } = data;

  // Calculate TDEE and targets (Mifflin-St Jeor)
  const weightKg = profile.weightLbs / 2.205;
  const heightCm = profile.heightIn * 2.54;
  // Mifflin-St Jeor: male +5, female -161 constant
  const bmrBase = 10 * weightKg + 6.25 * heightCm - 5 * profile.age;
  const bmr = profile.gender === "female" ? bmrBase - 161 : bmrBase + 5;
  const tdee = Math.round(bmr * AI_CONFIG.nutrition.activityMultiplier);
  // AI_CONFIG.nutrition.deficitKcalRange is "500-750" — use the midpoint for client-side display
  const targetCalories = tdee - 625;
  const targetProtein = AI_CONFIG.nutrition.proteinMinGrams;

  // Running totals
  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Format entries by slot for context
  const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
  const entryLines = SLOTS.flatMap((slot) =>
    entries
      .filter((e) => e.slot === slot)
      .map(
        (e) =>
          `${slot}: ${e.description} — ${Math.round(e.calories)} kcal, ${Math.round(e.protein)}g protein, ${Math.round(e.carbs)}g carbs, ${Math.round(e.fat)}g fat`
      )
  );
  const logSection = entryLines.length > 0 ? entryLines.join("\n") : "Nothing logged yet.";

  // Food library for suggestions
  const foodLibrarySection =
    foodItems.length > 0
      ? foodItems
          .map(
            (f) =>
              `${f.name} — ${f.calories} kcal, ${f.protein}g P, ${f.carbs}g C, ${f.fat}g F per ${f.serving || "serving"}`
          )
          .join("\n")
      : "No foods in library.";

  const system = `${AI_CONFIG.persona}

Your role: conversational nutrition tracking assistant. The user describes food they ate; you log it and guide their day.

Goal: ${AI_CONFIG.nutrition.goal}
Macro priorities: ${AI_CONFIG.nutrition.macroPriorities}

Today is ${date}. Food logged so far:
${logSection}

Running totals: ${Math.round(totals.calories)} kcal / ${Math.round(totals.protein)}g protein / ${Math.round(totals.carbs)}g carbs / ${Math.round(totals.fat)}g fat
Daily targets: ~${targetCalories} kcal / ${targetProtein}g+ protein

User's food library (prefer these when suggesting specific foods, supplement with general knowledge):
${foodLibrarySection}

IMPORTANT: Always respond with ONLY valid JSON in this exact format:
{ "reply": "...", "entries": [...] or null }

Rules:
- "reply": 2-4 sentences. If food was logged, comment on what was just added, running totals vs targets, and what to aim for in remaining meals. If it was a question/request, answer helpfully. Use the persona.
- "entries": array when the user described food they ate or plan to eat, null when the message is purely a question or request for suggestions. Example entry: { "description": "200g grilled chicken breast", "slot": "lunch", "calories": 330, "protein": 62, "carbs": 0, "fat": 7 }
- slot must be one of: breakfast, lunch, dinner, snack — infer from context (time references, what meal they mention, what's already logged). Default to snack if slot cannot be determined.
- Use the search_nutrition and search_web tools to look up actual macro data before estimating. Only use pure estimation as a last resort if both tools return nothing useful.
- Do not include markdown in "reply" — plain text only.

Tool use strategy:
- Call search_nutrition for EVERY food item you identify in the user's message before producing entries. Search one food at a time (e.g. "chicken breast", "white rice cooked", "olive oil").
- USDA returns values per 100g. Estimate the quantity in grams from context and scale: (quantity_g / 100) × per100g_value. Reference amounts: large chicken breast ≈ 180g cooked, 1 cup cooked rice ≈ 200g, 1 large egg ≈ 50g, 1 tbsp oil ≈ 14g, 1 cup milk ≈ 244g.
- If search_nutrition returns { "found": false } for a restaurant dish or complex meal, call search_web with a focused query like "hibachi steak shrimp restaurant typical ingredients portion sizes grams", then call search_nutrition for each ingredient found.
- You may call search_nutrition multiple times per turn — once per food item. This is expected and correct.
- Only fall back to pure estimation if both tools return no usable data.`;

  return { system };
}
