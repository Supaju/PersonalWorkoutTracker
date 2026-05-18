# Meal / Nutrition Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the food-library-assembly meal planner with a conversational AI food journal — side-by-side split layout, left panel shows the daily log grouped by meal slot, right panel is an AI chat where describing food logs it automatically.

**Architecture:** Two new Prisma models (`NutritionEntry`, `NutritionChat`) are added alongside the existing `MealPlan` (kept to avoid breaking `buildReviewPrompt` in `lib/ai.ts`). Five new API routes under `/api/nutrition/`. The meals page (`app/meals/page.tsx`) is fully rewritten. Old `/api/meals/plan`, `/api/meals/suggest`, `/api/meals/analyze` routes are deleted.

**Tech Stack:** Next.js 15 App Router, Prisma + SQLite, Anthropic Claude API (`claude-sonnet-4-6`), Tailwind CSS v4 with `var(--color-*)` CSS tokens, `.btn-accent` utility class.

**Critical context:**
- `lib/db.ts` exports `db` (Prisma client singleton) — use `import { db } from "@/lib/db"`
- `lib/ai.ts` exports `anthropic` (Anthropic client) and prompt builders — add `buildNutritionChatPrompt` here
- `lib/ai-config.ts` exports `AI_CONFIG` — contains `AI_CONFIG.persona`, `AI_CONFIG.nutrition.*`
- Dark theme: all UI uses CSS variables (`var(--color-bg)`, `var(--color-surface)`, `var(--color-border)`, `var(--color-text)`, `var(--color-text-faint)`, `var(--color-accent)`, `var(--color-accent-hover)`)
- No test harness exists in this project — use `npx tsc --noEmit` for type-checking
- TypeScript is strict but has pre-existing implicit-any errors in callbacks — do NOT fix those, only fix errors you introduce
- Do NOT touch: `app/api/cycle/advance/route.ts`, `app/api/sessions/[id]/route.ts` (they have uncommitted changes)

---

## File Map

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` — add NutritionEntry + NutritionChat models |
| Run | `npx prisma migrate dev --name nutrition_redesign` |
| Modify | `lib/ai.ts` — add `buildNutritionChatPrompt`, update import to include NutritionEntry |
| Create | `app/api/nutrition/route.ts` — GET entries + chat + targets for a date |
| Create | `app/api/nutrition/entries/route.ts` — POST manual entry |
| Create | `app/api/nutrition/entries/[id]/route.ts` — PUT + DELETE entry |
| Create | `app/api/nutrition/chat/route.ts` — POST AI chat |
| Rewrite | `app/meals/page.tsx` — full UI rewrite |
| Delete | `app/api/meals/plan/route.ts` |
| Delete | `app/api/meals/suggest/route.ts` |
| Delete | `app/api/meals/analyze/route.ts` |

---

## Task 1: Prisma schema — add NutritionEntry + NutritionChat

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the two new models to schema.prisma**

Open `prisma/schema.prisma` and add these two models at the end of the file (after the existing `WorkoutSession`/`SessionExercise`/`SetLog` models). Do NOT remove the `MealPlan` model — it is still used by `buildReviewPrompt` in `lib/ai.ts`.

```prisma
model NutritionEntry {
  id          String   @id @default(cuid())
  date        String
  slot        String
  description String
  calories    Float
  protein     Float
  carbs       Float
  fat         Float
  source      String
  createdAt   DateTime @default(now())
}

model NutritionChat {
  id        String   @id @default(cuid())
  date      String
  role      String
  content   String
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Run the migration**

```bash
cd C:/Code/WorkoutTracker
npx prisma migrate dev --name nutrition_redesign
```

Expected: migration created and applied, Prisma client regenerated. You should see "Your database is now in sync with your schema."

- [ ] **Step 3: Verify types are available**

```bash
npx tsc --noEmit
```

Expected: 0 new errors (pre-existing errors are acceptable — do not fix them).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add NutritionEntry and NutritionChat prisma models"
```

---

## Task 2: AI prompt builder — buildNutritionChatPrompt

**Files:**
- Modify: `lib/ai.ts`

- [ ] **Step 1: Update the import line at the top of lib/ai.ts**

The current import line 2 is:
```typescript
import type { UserProfile, Equipment, FoodItem, MealPlan, SessionExercise, SetLog, WorkoutSession } from "@prisma/client";
```

Change it to:
```typescript
import type { UserProfile, Equipment, FoodItem, MealPlan, SessionExercise, SetLog, WorkoutSession, NutritionEntry } from "@prisma/client";
```

- [ ] **Step 2: Add buildNutritionChatPrompt at the end of lib/ai.ts**

Append this function after the existing `buildRefinePrompt` function:

```typescript
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
  const bmr =
    profile.gender === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * profile.age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * profile.age - 161;
  const tdee = Math.round(bmr * AI_CONFIG.nutrition.activityMultiplier);
  const targetCalories = tdee - 625; // midpoint of 500-750 deficit
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
- "entries": array of { "description": string, "slot": string, "calories": number, "protein": number, "carbs": number, "fat": number } when the user described food they ate or plan to eat. Set to null when the message is purely a question or request for suggestions with no food to log.
- slot must be one of: breakfast, lunch, dinner, snack — infer from context (time references, what meal they mention, what's already logged).
- Estimate macros accurately from the food description using your knowledge. Be realistic, not conservative.
- Do not include markdown in "reply" — plain text only.`;

  return { system };
}
```

- [ ] **Step 3: Verify types**

```bash
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/ai.ts
git commit -m "feat: add buildNutritionChatPrompt to lib/ai.ts"
```

---

## Task 3: GET /api/nutrition — fetch day data

**Files:**
- Create: `app/api/nutrition/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AI_CONFIG } from "@/lib/ai-config";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const [entries, chat, profile] = await Promise.all([
    db.nutritionEntry.findMany({ where: { date }, orderBy: { createdAt: "asc" } }),
    db.nutritionChat.findMany({ where: { date }, orderBy: { createdAt: "asc" } }),
    db.userProfile.findFirst(),
  ]);

  let targets = { calories: 2000, protein: AI_CONFIG.nutrition.proteinMinGrams };
  if (profile) {
    const weightKg = profile.weightLbs / 2.205;
    const heightCm = profile.heightIn * 2.54;
    const bmr =
      profile.gender === "male"
        ? 10 * weightKg + 6.25 * heightCm - 5 * profile.age + 5
        : 10 * weightKg + 6.25 * heightCm - 5 * profile.age - 161;
    const tdee = Math.round(bmr * AI_CONFIG.nutrition.activityMultiplier);
    targets = { calories: tdee - 625, protein: AI_CONFIG.nutrition.proteinMinGrams };
  }

  return NextResponse.json({ entries, chat, targets });
}
```

- [ ] **Step 2: Verify with curl (after dev server is running)**

Start the dev server in a separate terminal: `npm run dev`

Then test:
```bash
curl "http://localhost:3000/api/nutrition?date=2026-05-18"
```

Expected: `{"entries":[],"chat":[],"targets":{"calories":<number>,"protein":180}}`

If profile is not set up yet, targets will be `{"calories":2000,"protein":180}` (the fallback).

- [ ] **Step 3: Commit**

```bash
git add app/api/nutrition/route.ts
git commit -m "feat: GET /api/nutrition - fetch entries, chat, and targets for a date"
```

---

## Task 4: POST /api/nutrition/entries — manual entry add

**Files:**
- Create: `app/api/nutrition/entries/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { date, slot, description, calories, protein, carbs, fat } = await req.json();
  if (!date || !slot || !description) {
    return NextResponse.json({ error: "date, slot, and description are required" }, { status: 400 });
  }
  const entry = await db.nutritionEntry.create({
    data: { date, slot, description, calories: Number(calories), protein: Number(protein), carbs: Number(carbs), fat: Number(fat), source: "manual" },
  });
  return NextResponse.json(entry);
}
```

- [ ] **Step 2: Verify with curl**

```bash
curl -X POST http://localhost:3000/api/nutrition/entries \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-05-18","slot":"breakfast","description":"2 eggs scrambled","calories":180,"protein":14,"carbs":1,"fat":13}'
```

Expected: JSON object with id, date, slot, description, calories, protein, carbs, fat, source, createdAt.

- [ ] **Step 3: Commit**

```bash
git add app/api/nutrition/entries/route.ts
git commit -m "feat: POST /api/nutrition/entries - manual nutrition entry"
```

---

## Task 5: PUT + DELETE /api/nutrition/entries/[id]

**Files:**
- Create: `app/api/nutrition/entries/[id]/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const entry = await db.nutritionEntry.update({
    where: { id },
    data: {
      ...(body.description !== undefined && { description: body.description }),
      ...(body.slot !== undefined && { slot: body.slot }),
      ...(body.calories !== undefined && { calories: Number(body.calories) }),
      ...(body.protein !== undefined && { protein: Number(body.protein) }),
      ...(body.carbs !== undefined && { carbs: Number(body.carbs) }),
      ...(body.fat !== undefined && { fat: Number(body.fat) }),
    },
  });
  return NextResponse.json(entry);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.nutritionEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

**Note:** `params` is a `Promise` in Next.js 15 App Router — always `await params` before destructuring. This matches the pattern in `app/api/sessions/[id]/route.ts`.

- [ ] **Step 2: Verify with curl (use the id returned from Task 4's POST)**

Replace `<entry-id>` with the actual id from Task 4:

```bash
# Edit
curl -X PUT http://localhost:3000/api/nutrition/entries/<entry-id> \
  -H "Content-Type: application/json" \
  -d '{"calories":200,"protein":16}'

# Delete
curl -X DELETE http://localhost:3000/api/nutrition/entries/<entry-id>
```

Expected for PUT: updated entry JSON. Expected for DELETE: `{"ok":true}`.

- [ ] **Step 3: Commit**

```bash
git add app/api/nutrition/entries/[id]/route.ts
git commit -m "feat: PUT + DELETE /api/nutrition/entries/[id] - edit and delete entries"
```

---

## Task 6: POST /api/nutrition/chat — AI chat endpoint

**Files:**
- Create: `app/api/nutrition/chat/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropic, buildNutritionChatPrompt } from "@/lib/ai";

export async function POST(req: Request) {
  const { date, message } = await req.json();
  if (!date || !message) {
    return NextResponse.json({ error: "date and message are required" }, { status: 400 });
  }

  const [profile, entries, chatHistory, foodItems] = await Promise.all([
    db.userProfile.findFirst(),
    db.nutritionEntry.findMany({ where: { date }, orderBy: { createdAt: "asc" } }),
    db.nutritionChat.findMany({ where: { date }, orderBy: { createdAt: "asc" } }),
    db.foodItem.findMany(),
  ]);

  if (!profile) {
    return NextResponse.json({ error: "No profile found. Please set up your profile first." }, { status: 400 });
  }

  const { system } = buildNutritionChatPrompt({ profile, entries, foodItems, date });

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...chatHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";

    let reply = "";
    let parsedEntries: Array<{ description: string; slot: string; calories: number; protein: number; carbs: number; fat: number }> = [];

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        reply = parsed.reply ?? "";
        parsedEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
      } else {
        reply = text;
      }
    } catch {
      reply = text;
    }

    // Save new nutrition entries
    const createdEntries = await Promise.all(
      parsedEntries.map((e) =>
        db.nutritionEntry.create({
          data: {
            date,
            slot: e.slot,
            description: e.description,
            calories: Number(e.calories),
            protein: Number(e.protein),
            carbs: Number(e.carbs),
            fat: Number(e.fat),
            source: "ai",
          },
        })
      )
    );

    // Save chat messages (store only reply text, not full JSON)
    await db.nutritionChat.createMany({
      data: [
        { date, role: "user", content: message },
        { date, role: "assistant", content: reply },
      ],
    });

    return NextResponse.json({ reply, newEntries: createdEntries });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to get AI response. Check ANTHROPIC_API_KEY." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify with curl (requires ANTHROPIC_API_KEY in .env.local)**

```bash
curl -X POST http://localhost:3000/api/nutrition/chat \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-05-18","message":"I had a bowl of oatmeal with peanut butter for breakfast"}'
```

Expected: `{"reply":"...","newEntries":[{"id":"...","slot":"breakfast","description":"Bowl of oatmeal with peanut butter",...}]}`

- [ ] **Step 3: Commit**

```bash
git add app/api/nutrition/chat/route.ts
git commit -m "feat: POST /api/nutrition/chat - AI food logging chat endpoint"
```

---

## Task 7: Rewrite app/meals/page.tsx

**Files:**
- Rewrite: `app/meals/page.tsx`

This is a full replacement of the existing file. Read the current file first, then replace the entire contents.

- [ ] **Step 1: Replace app/meals/page.tsx with the new implementation**

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import type { FoodItem } from "@prisma/client";

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
type Slot = (typeof SLOTS)[number];
const SLOT_LABELS: Record<Slot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

interface NutritionEntry {
  id: string;
  date: string;
  slot: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  date: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface DayTargets {
  calories: number;
  protein: number;
}

export default function MealsPage() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [targets, setTargets] = useState<DayTargets>({ calories: 2000, protein: 180 });
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    description: "",
    slot: "lunch" as Slot,
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [addingManual, setAddingManual] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    slot: "lunch" as Slot,
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  const [showLibrary, setShowLibrary] = useState(false);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [foodForm, setFoodForm] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    serving: "",
  });
  const [addingFood, setAddingFood] = useState(false);
  const [showFoodForm, setShowFoodForm] = useState(false);

  const loadData = async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nutrition?date=${d}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
      setChat(data.chat ?? []);
      if (data.targets) setTargets(data.targets);
    } finally {
      setLoading(false);
    }
  };

  const loadFoods = () =>
    fetch("/api/meals/foods")
      .then((r) => r.json())
      .then(setFoods);

  useEffect(() => {
    loadData(date);
  }, [date]);

  useEffect(() => {
    if (showLibrary) loadFoods();
  }, [showLibrary]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, sending]);

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setMessage("");

    const tempId = "temp-" + Date.now();
    setChat((prev) => [
      ...prev,
      { id: tempId, date, role: "user", content: text, createdAt: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/nutrition/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChat((prev) => [
          ...prev,
          {
            id: "err-" + Date.now(),
            date,
            role: "assistant",
            content: "Error: " + (data.error || "Failed to get response."),
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }
      await loadData(date);
    } catch {
      setChat((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          date,
          role: "assistant",
          content: "Failed to connect. Check your connection and try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const deleteEntry = async (id: string) => {
    await fetch(`/api/nutrition/entries/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const startEdit = (entry: NutritionEntry) => {
    setEditingId(entry.id);
    setEditForm({
      description: entry.description,
      slot: entry.slot as Slot,
      calories: String(Math.round(entry.calories)),
      protein: String(Math.round(entry.protein)),
      carbs: String(Math.round(entry.carbs)),
      fat: String(Math.round(entry.fat)),
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/nutrition/entries/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: editForm.description,
        slot: editForm.slot,
        calories: parseFloat(editForm.calories) || 0,
        protein: parseFloat(editForm.protein) || 0,
        carbs: parseFloat(editForm.carbs) || 0,
        fat: parseFloat(editForm.fat) || 0,
      }),
    });
    const updated = await res.json();
    setEntries((prev) => prev.map((e) => (e.id === editingId ? updated : e)));
    setEditingId(null);
  };

  const addManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingManual(true);
    try {
      const res = await fetch("/api/nutrition/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          slot: manualForm.slot,
          description: manualForm.description,
          calories: parseFloat(manualForm.calories) || 0,
          protein: parseFloat(manualForm.protein) || 0,
          carbs: parseFloat(manualForm.carbs) || 0,
          fat: parseFloat(manualForm.fat) || 0,
        }),
      });
      const entry = await res.json();
      setEntries((prev) => [...prev, entry]);
      setManualForm({ description: "", slot: "lunch", calories: "", protein: "", carbs: "", fat: "" });
      setShowManual(false);
    } finally {
      setAddingManual(false);
    }
  };

  const handleAddFood = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingFood(true);
    await fetch("/api/meals/foods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(foodForm),
    });
    setFoodForm({ name: "", calories: "", protein: "", carbs: "", fat: "", serving: "" });
    setShowFoodForm(false);
    await loadFoods();
    setAddingFood(false);
  };

  const handleDeleteFood = async (id: string) => {
    await fetch(`/api/meals/foods?id=${id}`, { method: "DELETE" });
    setFoods((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">
        Nutrition
      </h2>
      <p className="text-[var(--color-text-faint)] text-sm mb-4">
        Tell Claude what you ate — it logs it, tracks your macros, and advises for the rest of the day.
      </p>

      {/* Date picker */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Left: Food Log */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <p className="text-[var(--color-text-faint)] text-sm">Loading...</p>
          ) : (
            <>
              {SLOTS.map((slot) => {
                const slotEntries = entries.filter((e) => e.slot === slot);
                return (
                  <div
                    key={slot}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4"
                  >
                    <h4 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-3">
                      {SLOT_LABELS[slot]}
                    </h4>
                    {slotEntries.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-faint)] italic">Nothing logged</p>
                    ) : (
                      <ul className="space-y-2">
                        {slotEntries.map((entry) =>
                          editingId === entry.id ? (
                            <li
                              key={entry.id}
                              className="space-y-2 border border-[var(--color-border)] p-3 bg-[var(--color-bg)]"
                            >
                              <input
                                value={editForm.description}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, description: e.target.value })
                                }
                                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                              />
                              <select
                                value={editForm.slot}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, slot: e.target.value as Slot })
                                }
                                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                              >
                                {SLOTS.map((s) => (
                                  <option key={s} value={s}>
                                    {SLOT_LABELS[s]}
                                  </option>
                                ))}
                              </select>
                              <div className="grid grid-cols-4 gap-2">
                                {(["calories", "protein", "carbs", "fat"] as const).map((field) => (
                                  <div key={field}>
                                    <label className="block text-xs text-[var(--color-text-faint)] mb-0.5">
                                      {field === "calories" ? "kcal" : field.charAt(0).toUpperCase() + field.slice(1) + " g"}
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.1}
                                      value={editForm[field]}
                                      onChange={(e) =>
                                        setEditForm({ ...editForm, [field]: e.target.value })
                                      }
                                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button onClick={saveEdit} className="btn-accent text-xs">
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </li>
                          ) : (
                            <li key={entry.id} className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm text-[var(--color-text)]">{entry.description}</p>
                                <p className="text-xs text-[var(--color-text-faint)]">
                                  {Math.round(entry.calories)} kcal · P:{" "}
                                  {Math.round(entry.protein)}g · C: {Math.round(entry.carbs)}g · F:{" "}
                                  {Math.round(entry.fat)}g
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => startEdit(entry)}
                                  className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors p-0.5"
                                  aria-label="Edit"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => deleteEntry(entry.id)}
                                  className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors p-0.5"
                                  aria-label="Delete"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}

              {/* Manual add */}
              {showManual ? (
                <form
                  onSubmit={addManual}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 space-y-2"
                >
                  <p className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-2">
                    Add Manually
                  </p>
                  <input
                    required
                    placeholder="Description (e.g. 2 eggs, 200g chicken breast)"
                    value={manualForm.description}
                    onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                  <select
                    value={manualForm.slot}
                    onChange={(e) => setManualForm({ ...manualForm, slot: e.target.value as Slot })}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    {SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {SLOT_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    {(["calories", "protein", "carbs", "fat"] as const).map((field) => (
                      <input
                        key={field}
                        required
                        type="number"
                        min={0}
                        step={0.1}
                        placeholder={
                          field === "calories"
                            ? "Calories (kcal)"
                            : field.charAt(0).toUpperCase() + field.slice(1) + " (g)"
                        }
                        value={manualForm[field]}
                        onChange={(e) => setManualForm({ ...manualForm, [field]: e.target.value })}
                        className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={addingManual} className="btn-accent text-xs">
                      {addingManual ? "Adding..." : "Add Entry"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManual(false)}
                      className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowManual(true)}
                  className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium uppercase tracking-wider self-start"
                >
                  + Add manually
                </button>
              )}

              {/* Daily totals */}
              <div className="bg-[var(--color-bg)] border border-[var(--color-border)] p-4">
                <h4 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-3">
                  Daily Totals
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(
                    [
                      { label: "Calories", value: Math.round(totals.calories), unit: "kcal", color: "text-[#dc2626]", target: targets.calories },
                      { label: "Protein", value: Math.round(totals.protein), unit: "g", color: "text-[#86efac]", target: targets.protein },
                      { label: "Carbs", value: Math.round(totals.carbs), unit: "g", color: "text-[#fdba74]", target: null },
                      { label: "Fat", value: Math.round(totals.fat), unit: "g", color: "text-[#f87171]", target: null },
                    ] as const
                  ).map(({ label, value, unit, color, target }) => (
                    <div key={label}>
                      <p className={`text-lg font-bold ${color}`}>
                        {value}
                        <span className="text-xs font-normal ml-0.5">{unit}</span>
                      </p>
                      <p className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider">
                        {label}
                      </p>
                      {target !== null && (
                        <p className="text-xs text-[var(--color-text-faint)]">
                          / {target}{unit}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: AI Chat */}
        <div className="flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[500px] max-h-[700px]">
            {chat.length === 0 && !loading && (
              <p className="text-xs text-[var(--color-text-faint)] italic">
                Tell Claude what you ate and it will log it, track your macros, and guide the rest
                of your day. Or ask for meal suggestions.
              </p>
            )}
            {chat.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                      : "bg-[#110a1a] border border-[#2a1a3a] text-[#c4b5fd]"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-[#110a1a] border border-[#2a1a3a] px-3 py-2">
                  <span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] animate-pulse align-middle" />
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
          <div className="border-t border-[var(--color-border)] p-3 flex gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="I had a large chicken burrito for lunch..."
              rows={2}
              className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !message.trim()}
              className="btn-accent text-xs self-end"
            >
              {sending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Food Library (collapsible) */}
      <div className="border-t border-[var(--color-border)] pt-6">
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-4 uppercase tracking-widest"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showLibrary ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          Manage Food Library
        </button>

        {showLibrary && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--color-text-faint)]">
                Foods Claude references when suggesting meals. Add anything you regularly eat.
              </p>
              <button
                onClick={() => setShowFoodForm(!showFoodForm)}
                className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium uppercase tracking-wider"
              >
                {showFoodForm ? "Cancel" : "+ Add food"}
              </button>
            </div>

            {showFoodForm && (
              <form
                onSubmit={handleAddFood}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 space-y-2"
              >
                <input
                  required
                  placeholder="Food name"
                  value={foodForm.name}
                  onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                <input
                  placeholder="Serving size (e.g. 100g)"
                  value={foodForm.serving}
                  onChange={(e) => setFoodForm({ ...foodForm, serving: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                <div className="grid grid-cols-2 gap-2">
                  {(["calories", "protein", "carbs", "fat"] as const).map((field) => (
                    <input
                      key={field}
                      required
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder={
                        field.charAt(0).toUpperCase() +
                        field.slice(1) +
                        (field === "calories" ? " (kcal)" : " (g)")
                      }
                      value={foodForm[field]}
                      onChange={(e) => setFoodForm({ ...foodForm, [field]: e.target.value })}
                      className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={addingFood}
                  className="btn-accent w-full justify-center text-xs"
                >
                  {addingFood ? "Adding..." : "Add Food"}
                </button>
              </form>
            )}

            <div className="space-y-2">
              {foods.length === 0 && (
                <p className="text-[var(--color-text-faint)] text-sm">No foods yet.</p>
              )}
              {foods.map((food) => (
                <div
                  key={food.id}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3 flex items-start justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{food.name}</p>
                    {food.serving && (
                      <p className="text-xs text-[var(--color-text-faint)]">{food.serving}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-[var(--color-text-faint)]">
                      <span>{food.calories} kcal</span>
                      <span>P: {food.protein}g</span>
                      <span>C: {food.carbs}g</span>
                      <span>F: {food.fat}g</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteFood(food.id)}
                    className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 new errors introduced by this file.

- [ ] **Step 3: Visual check in browser**

With `npm run dev` running, open http://localhost:3000/meals

Expected:
- "Nutrition" heading with subtitle
- Date picker defaulting to today
- Two-column split: left shows 4 meal slot sections (empty), right shows the chat panel with placeholder text
- "+ Add manually" button below slots
- Daily Totals card showing all zeros
- "Manage Food Library" collapsible at the bottom

Send a chat message (e.g. "I had oatmeal with peanut butter for breakfast") and verify:
- User message appears right-aligned
- Loading indicator shows
- AI reply appears left-aligned in purple
- Entry appears in the Breakfast slot on the left
- Totals card updates

- [ ] **Step 4: Commit**

```bash
git add app/meals/page.tsx
git commit -m "feat: rewrite meals page - conversational AI food journal with split layout"
```

---

## Task 8: Cleanup — delete old routes and push

**Files:**
- Delete: `app/api/meals/plan/route.ts`
- Delete: `app/api/meals/suggest/route.ts`
- Delete: `app/api/meals/analyze/route.ts`

- [ ] **Step 1: Delete the old meal API routes**

These routes are no longer called by any part of the app. The food library route (`app/api/meals/foods/route.ts`) must NOT be deleted — the meals page still uses it.

```bash
rm app/api/meals/plan/route.ts
rm app/api/meals/suggest/route.ts
rm app/api/meals/analyze/route.ts
```

- [ ] **Step 2: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 new errors. Note: `lib/ai.ts` still exports `buildMealPlanPrompt` and `buildDeviationPrompt` — these are now dead code but do NOT delete them as they are imported nowhere that causes compile errors and removing them risks breaking `buildReviewPrompt`'s context.

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "feat: meal nutrition redesign complete - conversational AI food journal"
git push
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Side-by-side B layout — Task 7
- [x] Date picker defaulting to today — Task 7
- [x] NutritionEntry + NutritionChat models — Task 1
- [x] GET /api/nutrition with targets — Task 3
- [x] POST /api/nutrition/chat — Task 6
- [x] PUT + DELETE /api/nutrition/entries/[id] — Task 5
- [x] POST /api/nutrition/entries (manual) — Task 4
- [x] Entries grouped by meal slot — Task 7
- [x] Inline editing (description + slot + all macros) — Task 7
- [x] Daily totals card with targets — Task 7
- [x] Food library collapsible section — Task 7
- [x] AI infers meal slot from context — Task 2 (prompt instruction)
- [x] AI sees food library when suggesting — Task 2 (prompt includes foodLibrarySection)
- [x] AI sees full day history on each message — Task 6 (loads chatHistory + entries)
- [x] Old meal routes deleted — Task 8
- [x] MealPlan model kept (buildReviewPrompt compatibility) — noted in Task 1

**No placeholders:** All code is complete in each step.

**Type consistency:** `NutritionEntry` interface defined in page matches Prisma model fields. `DayTargets` matches what GET route returns. `params` in [id] routes correctly typed as `Promise<{ id: string }>`.
