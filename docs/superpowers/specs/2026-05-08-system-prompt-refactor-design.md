# Design: System Prompt Refactor + Gym Bro Persona

**Date:** 2026-05-08  
**Status:** Approved

## Goal

Refactor the Claude API calls in WorkoutTracker to use the dedicated `system` parameter instead of embedding persona text inside user messages. Add a single `PERSONA` constant to make the AI's tone easy to change in one place.

## Problem

All four `build*Prompt` functions in `lib/ai.ts` return a single string that begins with a persona sentence (e.g. "You are an expert personal trainer..."). This string is passed entirely as the user message content. The Claude API has a dedicated `system` parameter that is the correct home for persona and standing rules — using it improves caching, clarity, and maintainability.

## Changes

### `lib/ai.ts`

1. Add a `PERSONA` constant at the top of the file — the single place to edit tone:

```ts
const PERSONA = `You have the energy and enthusiasm of a knowledgeable gym bro — encouraging, real, and occasionally dropping terms like "let's get it", "solid gains", or "bro", but always backed by evidence-based practice. Be direct and no-BS.`
```

2. Change each `build*Prompt` function return type from `string` to `{ system: string; user: string }`.

3. Extract the role/persona sentence from each function's current return string into `system`, compose it with `PERSONA`. The remaining content (profile data, history, format instructions) becomes `user`.

| Function | `system` role text |
|---|---|
| `buildPlanPrompt` | `You are an expert personal trainer and exercise scientist.` |
| `buildMealPlanPrompt` | `You are a sports nutritionist who knows macros and body composition inside out.` |
| `buildDeviationPrompt` | `You are a sports nutritionist helping someone understand how their food choices fit their goals.` |
| `buildReviewPrompt` | `You are a certified personal trainer and sports nutritionist reviewing a client's program. Be direct, specific, and constructive.` |

### Route files (4 files)

Each route destructures the return value and passes `system` as a top-level parameter:

```ts
// Before
const prompt = buildXPrompt(data);
messages: [{ role: "user", content: prompt }]

// After
const { system, user } = buildXPrompt(data);
system,
messages: [{ role: "user", content: user }]
```

**Affected routes:**
- `app/api/sessions/plan/route.ts`
- `app/api/ai/review/route.ts`
- `app/api/meals/suggest/route.ts`
- `app/api/meals/analyze/route.ts`

## What Does Not Change

- Prompt content (all existing instructions, format specs, data sections) is untouched
- No new features, no logic changes
- Streaming vs non-streaming behavior in routes is unchanged

## Future Changes

To change the AI's personality: edit the `PERSONA` constant in `lib/ai.ts`.  
To change a role's expertise framing: edit the `system` string in the relevant `build*` function.
