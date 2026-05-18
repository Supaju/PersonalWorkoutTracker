# Meal / Nutrition Redesign — Design Spec

**Goal:** Replace the food-library-assembly meal planner with an AI-powered conversational food journal where the user describes what they ate and Claude logs, analyzes, and advises.

**Architecture:** Side-by-side split panel (log left, AI chat right). Two new Prisma models (`NutritionEntry`, `NutritionChat`) replace `MealPlan`. Non-streaming JSON chat endpoint mirrors the plan-revision pattern. Food library stays for AI suggestion context and manual reference.

**Tech Stack:** Next.js 15 App Router, Prisma + SQLite, Anthropic Claude API (`claude-sonnet-4-6`), Tailwind CSS v4 dark theme (`var(--color-*)` tokens).

---

## Data Model

### Remove
- `MealPlan` model (replaced entirely)

### Add

```prisma
model NutritionEntry {
  id          String   @id @default(cuid())
  date        String                          // YYYY-MM-DD
  slot        String                          // breakfast | lunch | dinner | snack
  description String
  calories    Float
  protein     Float
  carbs       Float
  fat         Float
  source      String                          // "ai" | "manual"
  createdAt   DateTime @default(now())
}

model NutritionChat {
  id        String   @id @default(cuid())
  date      String                            // YYYY-MM-DD
  role      String                            // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())
}
```

### Keep unchanged
- `FoodItem` — food library catalog
- All other models

---

## API Routes

### Remove
- `app/api/meals/plan/route.ts`
- `app/api/meals/suggest/route.ts`
- `app/api/meals/analyze/route.ts`

### Keep
- `app/api/meals/foods/route.ts` — food library CRUD, unchanged

### Add

#### `GET /api/nutrition?date=YYYY-MM-DD`
Returns `{ entries: NutritionEntry[], chat: NutritionChat[] }` for the given date.

#### `POST /api/nutrition/chat`
Body: `{ date: string, message: string }`

Steps:
1. Load `NutritionEntry[]` for the date (running totals context)
2. Load `NutritionChat[]` for the date (conversation history)
3. Load all `FoodItem[]` (food library for suggestions)
4. Load `UserProfile` (calorie/macro targets)
5. Build system prompt from `ai-config.ts` nutrition config
6. Send to Claude with full conversation history + new user message
7. Parse JSON response `{ reply: string, entries: Array<{ description, slot, calories, protein, carbs, fat }> | null }`
8. Save new `NutritionEntry` rows (source: "ai") if `entries` is not null
9. Save user message and AI reply text (not the full JSON — just `reply`) to `NutritionChat`
10. Return `{ reply: string, newEntries: NutritionEntry[] }`

Claude system prompt instructs: always return valid JSON `{ reply, entries }`. `entries` is an array when food was described (Claude estimates macros using its knowledge), null when the message is a question or suggestion request. Claude infers meal slot from message content and time context. Reply addresses: what was logged, running day totals vs targets, what to aim for in remaining meals. When suggesting foods, prefer items from the user's food library but supplement with general knowledge.

#### `PUT /api/nutrition/entries/[id]`
Body: partial `{ description?, slot?, calories?, protein?, carbs?, fat? }`
Updates the entry. Returns updated `NutritionEntry`.

#### `DELETE /api/nutrition/entries/[id]`
Deletes the entry. Returns `{ ok: true }`.

#### `POST /api/nutrition/entries`
Body: `{ date, slot, description, calories, protein, carbs, fat }`
Creates entry with `source: "manual"`. Returns created `NutritionEntry`.

---

## UI: `app/meals/page.tsx` (full rewrite)

### Page structure
Two-column split layout matching the app's dark theme. Date picker at the very top spanning full width, defaulting to today.

```
[ Date: 2026-05-18          ]
[ Left Panel  | Right Panel ]
[ Food Log    | AI Chat     ]
[             |             ]
[ Manage Food Library (collapsible, below split) ]
```

### Left panel — Food Log

**Grouped by meal slot.** Four sections always visible: Breakfast, Lunch, Dinner, Snack. Empty sections show a faint "Nothing logged" placeholder.

**Each entry row:**
- Description text (primary)
- Calories · P: Xg · C: Xg · F: Xg (secondary, smaller)
- Edit button (pencil icon) and delete button (×) on the right

**Inline editing:** clicking edit replaces the row with inputs for description (text), slot (select), calories, protein, carbs, fat — pre-filled. Save / Cancel buttons. `PUT /api/nutrition/entries/[id]` on save.

**Daily totals card** pinned at the bottom of the left panel:
- Four macro cells: Calories (red), Protein (green), Carbs (orange), Fat (blue) — matching existing color scheme
- Below each: target value from ai-config.ts (calories = TDEE − deficit midpoint; protein = proteinMinGrams)
- Color indicator: green if on track, amber if protein under target, red if calories over target

**Manual add:** `+ Add manually` button at the bottom of the entry list (above totals card). Expands an inline form: description, slot (select), calories, protein, carbs, fat. Submit → `POST /api/nutrition/entries`, collapses form on success.

### Right panel — AI Chat

Scrollable conversation thread. User messages right-aligned, AI messages left-aligned. Both use the dark surface + border styling from existing components.

Input area pinned at the bottom: multi-line textarea (2 rows, expands on focus) + Send button (`btn-accent`). Sending is disabled while loading.

Loading state: spinner in place of AI message bubble while waiting for response.

On send:
1. Append user message to thread optimistically
2. POST to `/api/nutrition/chat`
3. On response: append AI reply, update left panel with any new entries

Error state: show error message inline in chat if API fails.

### Below the split — Food Library (collapsible)

Toggle button: `▶ Manage Food Library` / `▼ Manage Food Library`.

When expanded: shows existing food library UI (add form + list of food items with delete). This is the same content as the current left column of the existing meals page, moved here. Uses `/api/meals/foods` routes unchanged.

---

## AI Prompt Design

System prompt (built in `lib/ai.ts`):

```
[ai-config.ts persona]
[ai-config.ts nutrition goal, targets, macro priorities]

Today is [date]. The user has logged the following so far:
[slot: description — Xcal, Pg, Cg, Fg] (one line per entry, or "Nothing logged yet")

Running totals: Xcal / Xg protein / Xg carbs / Xg fat
Targets: ~Xcal / Xg+ protein

User's food library (use these when suggesting specific foods):
[food name — Xcal, Pg, Cg, Fg per serving]

IMPORTANT: Respond ONLY with valid JSON: { "reply": "...", "entries": [...] | null }
- "reply": 2–4 sentences. Address what was just logged, their daily progress, and what to aim for in remaining meals.
- "entries": array of { "description", "slot", "calories", "protein", "carbs", "fat" } when food was described. null when the message is a question or request for suggestions.
- Infer meal slot from context (time references, meal names, what makes sense given what's already logged).
- Use your knowledge to estimate calories and macros from descriptions. Be accurate — not conservative.
```

---

## What Does NOT Change

- `FoodItem` model and `/api/meals/foods` routes
- `ai-config.ts` nutrition config (consumed by the new prompt builder)
- App dark theme, CSS tokens, sidebar navigation
- Nav link label stays "Meals"

---

## Out of Scope

- Historical nutrition charts (separate feature)
- Exporting logs
- Per-entry timestamps (date-level granularity is sufficient)
- Editing the food library from within the chat
