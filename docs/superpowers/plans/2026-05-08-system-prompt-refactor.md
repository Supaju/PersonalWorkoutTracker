# System Prompt Refactor + Gym Bro Persona Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor all Claude API calls to use the dedicated `system` parameter, and add a single `PERSONA` constant in `lib/ai.ts` to control the AI's tone across all features.

**Architecture:** Each `build*Prompt` function in `lib/ai.ts` currently returns a single string with persona text embedded at the top. We split the return into `{ system: string; user: string }` — `system` holds the role + persona, `user` holds the task-specific content. Four route files are updated to destructure and pass `system` as a top-level API parameter.

**Tech Stack:** TypeScript, Next.js App Router, `@anthropic-ai/sdk`

---

## File Map

| File | Change |
|---|---|
| `lib/ai.ts` | Add `PERSONA` constant; change 4 `build*` functions to return `{ system, user }` |
| `app/api/sessions/plan/route.ts` | Destructure `{ system, user }`, pass `system` to `messages.create` |
| `app/api/ai/review/route.ts` | Destructure `{ system, user }`, pass `system` to `messages.stream` |
| `app/api/meals/suggest/route.ts` | Destructure `{ system, user }`, pass `system` to `messages.create` |
| `app/api/meals/analyze/route.ts` | Destructure `{ system, user }`, pass `system` to `messages.stream` |

---

## Task 1: Update `lib/ai.ts`

**Files:**
- Modify: `lib/ai.ts`

- [ ] **Step 1: Add the PERSONA constant**

After line 7 (the closing `});` of the `anthropic` client), add:

```ts
// Edit this constant to change Claude's personality across all AI features.
const PERSONA = `You have the energy and enthusiasm of a knowledgeable gym bro — encouraging, real, and occasionally dropping terms like "let's get it", "solid gains", or "bro", but always backed by evidence-based practice. Be direct and no-BS.`;
```

- [ ] **Step 2: Update `buildPlanPrompt` return type and return value**

Change the function signature from:
```ts
export function buildPlanPrompt(data: { ... }): string {
```
To:
```ts
export function buildPlanPrompt(data: { ... }): { system: string; user: string } {
```

Replace the `return` statement at the bottom of the function (currently starts with `` return `You are an expert personal trainer... ``). The new return is:

```ts
  return {
    system: `You are an expert personal trainer and exercise scientist. ${PERSONA}`,
    user: `Design a ${tmpl.label} workout for this specific person.

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
}`,
  };
```

- [ ] **Step 3: Update `buildMealPlanPrompt` return type and return value**

Change the function signature from:
```ts
export function buildMealPlanPrompt(data: { ... }): string {
```
To:
```ts
export function buildMealPlanPrompt(data: { ... }): { system: string; user: string } {
```

Replace the `return` statement (currently starts with `` return `You are a sports nutritionist creating a daily meal plan... ``):

```ts
  return {
    system: `You are a sports nutritionist who knows macros and body composition inside out. ${PERSONA}`,
    user: `Create a daily meal plan. Use ONLY the foods listed below.

USER PROFILE:
- Age: ${profile.age}, Gender: ${profile.gender}
- Height: ${formatHeight(profile.heightIn)}, Weight: ${profile.weightLbs} lbs
- Goal: Fat loss while preserving and building practical muscle

NUTRITION TARGETS:
Calculate the user's TDEE using Mifflin-St Jeor (convert lbs to kg, inches to cm), apply a light activity multiplier (1.375 for 4x/week lifting), then subtract 500-750 kcal for a fat loss deficit.
- Protein target: minimum 180g/day (critical for muscle preservation during fat loss)
- Prioritize protein and vegetables; moderate carbs around workouts; keep fat moderate
- Spread across breakfast, lunch, dinner, and one snack

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
```

- [ ] **Step 4: Update `buildDeviationPrompt` return type and return value**

Change the function signature from:
```ts
export function buildDeviationPrompt(data: { ... }): string {
```
To:
```ts
export function buildDeviationPrompt(data: { ... }): { system: string; user: string } {
```

Replace the `return` statement (currently starts with `` return `You are a sports nutritionist helping a user... ``):

```ts
  return {
    system: `You are a sports nutritionist helping someone understand how their food choices fit their goals. ${PERSONA}`,
    user: `USER PROFILE:
- Age: ${profile.age}, Gender: ${profile.gender}
- Height: ${formatHeight(profile.heightIn)}, Weight: ${profile.weightLbs} lbs
- Goal: Fat loss while preserving muscle
- Approximate daily calorie target: Calculate TDEE (Mifflin-St Jeor, light activity 1.375) minus 500-750 kcal deficit

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
```

- [ ] **Step 5: Update `buildReviewPrompt` return type and return value**

Change the function signature from:
```ts
export function buildReviewPrompt(data: { ... }): string {
```
To:
```ts
export function buildReviewPrompt(data: { ... }): { system: string; user: string } {
```

Replace the `return` statement (currently starts with `` return `You are a certified personal trainer... ``):

```ts
  return {
    system: `You are a certified personal trainer and sports nutritionist reviewing a client's program. Be direct, specific, and constructive. ${PERSONA}`,
    user: `USER PROFILE:
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
List 3–5 specific, actionable adjustments to improve results.`,
  };
```

- [ ] **Step 6: Check TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see errors referencing the `build*` functions, check that the return type annotation matches the return object shape exactly.

- [ ] **Step 7: Commit**

```bash
git add lib/ai.ts
git commit -m "refactor: split build*Prompt into system/user, add PERSONA constant"
```

---

## Task 2: Update Route Files

**Files:**
- Modify: `app/api/sessions/plan/route.ts`
- Modify: `app/api/ai/review/route.ts`
- Modify: `app/api/meals/suggest/route.ts`
- Modify: `app/api/meals/analyze/route.ts`

- [ ] **Step 1: Update `app/api/sessions/plan/route.ts`**

Find:
```ts
  const prompt = buildPlanPrompt({
    profile,
    equipment,
    template,
    lastSameSession,
    lastAlternateLowerSession: lastAlternateLower,
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
```

Replace with:
```ts
  const { system, user } = buildPlanPrompt({
    profile,
    equipment,
    template,
    lastSameSession,
    lastAlternateLowerSession: lastAlternateLower,
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    });
```

- [ ] **Step 2: Update `app/api/ai/review/route.ts`**

Find:
```ts
  const prompt = buildReviewPrompt({
    profile,
    equipment,
    recentSessions,
    foodItems,
    mealPlan,
    currentTemplate,
  });

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
```

Replace with:
```ts
  const { system, user } = buildReviewPrompt({
    profile,
    equipment,
    recentSessions,
    foodItems,
    mealPlan,
    currentTemplate,
  });

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: user }],
  });
```

- [ ] **Step 3: Update `app/api/meals/suggest/route.ts`**

Find:
```ts
  const prompt = buildMealPlanPrompt({ profile, foodItems, date });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
```

Replace with:
```ts
  const { system, user } = buildMealPlanPrompt({ profile, foodItems, date });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    });
```

- [ ] **Step 4: Update `app/api/meals/analyze/route.ts`**

Find:
```ts
  const prompt = buildDeviationPrompt({ profile, description, currentPlanTotals, date });

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });
```

Replace with:
```ts
  const { system, user } = buildDeviationPrompt({ profile, description, currentPlanTotals, date });

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system,
    messages: [{ role: "user", content: user }],
  });
```

- [ ] **Step 5: Check TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/sessions/plan/route.ts app/api/ai/review/route.ts app/api/meals/suggest/route.ts app/api/meals/analyze/route.ts
git commit -m "refactor: pass system prompt via system parameter in all API routes"
```

---

## Manual Verification

Start the dev server and exercise each AI feature:

```bash
npm run dev
```

| Feature | How to trigger | What to check |
|---|---|---|
| Workout plan | Sessions page → Plan Session | AI generates a valid workout; tone feels like a gym bro trainer |
| Meal plan | Meals page → Suggest Plan | AI generates a valid meal plan |
| Meal deviation | Meals page → Log a deviation | AI responds with nutritional breakdown |
| Program review | Sessions page → AI Review | AI streams a structured review response |

If any feature returns a 500 or the AI response is blank, check the server console — a malformed `system` string (e.g. unclosed template literal) is the most likely cause.
