import Anthropic from "@anthropic-ai/sdk";
import type { UserProfile, Equipment, FoodItem, MealPlan, SessionExercise, SetLog, WorkoutSession } from "@prisma/client";
import { TEMPLATES, type TemplateId } from "@/lib/templates";

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
}): string {
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
    ? `LAST ${tmpl.label.toUpperCase()} SESSION (${lastSameSession.date}):\n${formatSession(lastSameSession)}\n\nApply progressive overload where appropriate. If a set was clearly too easy, increase weight 5-10 lbs. If the user struggled or failed reps, hold weight or reduce slightly.`
    : `No previous ${tmpl.label} sessions recorded. This is the first time. Start conservatively — the user is 380 lbs and returning/starting a structured program. Err on the side of lighter weights that allow good form and full rep ranges.`;

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

  return `You are an expert personal trainer and exercise scientist. Design a ${tmpl.label} workout for this specific person.

USER PROFILE:
- Age: ${profile.age}, Gender: ${profile.gender}
- Height: ${formatHeight(profile.heightIn)}, Weight: ${profile.weightLbs} lbs
- Goal: Lose fat while building practical, functional muscle (NOT bodybuilding)
- Target session length: ~60 minutes

AVAILABLE EQUIPMENT:
${equipmentList}

${tmpl.label.toUpperCase()} TEMPLATE STRUCTURE:
${slotDescriptions}

${historySection}
${alternateLowerNote}

EVIDENCE-BASED GUIDELINES FOR THIS USER:
- At 380 lbs, prioritize exercises that minimize joint stress while maximizing metabolic output
- Compound movements burn more calories — favor them
- Rep range 10-15 with 60-90s rest keeps heart rate elevated for fat loss while building muscle
- Seated/supported variations reduce lower back strain where appropriate
- Progressive overload is the primary driver of change — track and advance weights over time
- Avoid high axial spinal loading (e.g., heavy barbell back squats) until weight decreases
- Each session should feel challenging but completable — not form failure

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
}`;
}

// ---- Review prompt (existing feature, updated to use session history) ----

export function buildReviewPrompt(data: {
  profile: UserProfile;
  equipment: Equipment[];
  recentSessions: SessionWithExercises[];
  foodItems: FoodItem[];
  mealPlan: MealPlan | null;
  currentTemplate: TemplateId;
}): string {
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

  return `You are a certified personal trainer and sports nutritionist reviewing a user's fitness program. Be direct, specific, and constructive.

USER PROFILE:
- Age: ${profile.age}, Gender: ${profile.gender}
- Height: ${formatHeight(profile.heightIn)}, Weight: ${profile.weightLbs} lbs
- Goal: Lose fat through weight training, build practical muscle
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
Are the food choices supporting fat loss while preserving muscle? Assess protein adequacy (target: ~1g per lb of lean body mass).

## Overall Recommendations
List 3–5 specific, actionable adjustments to improve results.`;
}
