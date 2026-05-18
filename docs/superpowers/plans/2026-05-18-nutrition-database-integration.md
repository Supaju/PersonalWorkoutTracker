# Nutrition Database Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Claude's pure macro estimation with grounded USDA FoodData Central lookups and Tavily web search, using Claude tool use so it can research restaurant dishes before estimating.

**Architecture:** Two tools (`search_nutrition` via USDA, `search_web` via Tavily) added to the nutrition chat endpoint. The route runs a tool use loop until Claude produces its final JSON reply. A new `lib/nutrition-api.ts` owns all external fetch logic. The system prompt is updated to instruct Claude on the tool use strategy. No schema or frontend changes.

**Tech Stack:** Next.js 15 App Router, Anthropic Claude API tool use (`@anthropic-ai/sdk`), USDA FoodData Central REST API (free), Tavily Search API (free tier).

**Critical context:**
- `lib/db.ts` exports `db` (Prisma singleton) — `import { db } from "@/lib/db"`
- `lib/ai.ts` exports `anthropic` (Anthropic client instance) and `buildNutritionChatPrompt`
- `@anthropic-ai/sdk` is already installed — import `Anthropic` from it for type access
- No test harness — use `npx tsc --noEmit` for type-checking
- Pre-existing TypeScript errors in other files are acceptable; do NOT introduce new ones
- Do NOT touch: `app/api/cycle/advance/route.ts`, `app/api/sessions/[id]/route.ts`
- Working directory for all commands: `C:/Code/WorkoutTracker`

---

## File Map

| Action | File |
|--------|------|
| Create | `lib/nutrition-api.ts` — `searchNutrition()` and `searchWeb()` fetch functions |
| Create | `.env.example` — document all required env vars |
| Modify | `lib/ai.ts` — add tool use strategy instructions to `buildNutritionChatPrompt` |
| Modify | `app/api/nutrition/chat/route.ts` — tool definitions + tool use loop |

---

## Task 1: `lib/nutrition-api.ts` — USDA and Tavily fetch functions

**Files:**
- Create: `lib/nutrition-api.ts`
- Create: `.env.example`

- [ ] **Step 1: Add `USDA_API_KEY` and `TAVILY_API_KEY` to `.env.local`**

Open `C:\Code\WorkoutTracker\.env.local` and add these two lines (keep the existing `ANTHROPIC_API_KEY`):

```
USDA_API_KEY=DEMO_KEY
TAVILY_API_KEY=your_tavily_key_here
```

`DEMO_KEY` is a literal string that works with USDA without registration (40 req/day limit). Get a free registered USDA key at https://fdc.nal.usda.gov/api-guide.html for 1,000 req/day. Get a free Tavily key at https://tavily.com.

- [ ] **Step 2: Create `.env.example`**

Create `C:\Code\WorkoutTracker\.env.example` with this content:

```
ANTHROPIC_API_KEY=your_anthropic_key_here
USDA_API_KEY=DEMO_KEY   # or register free at https://fdc.nal.usda.gov/api-guide.html for 1000 req/day
TAVILY_API_KEY=your_tavily_key_here   # free at https://tavily.com (1000 req/month)
```

- [ ] **Step 3: Create `lib/nutrition-api.ts`**

Create `C:\Code\WorkoutTracker\lib\nutrition-api.ts` with this exact content:

```typescript
const USDA_BASE = "https://api.nal.usda.gov/fdc/v1/foods/search";
const TAVILY_BASE = "https://api.tavily.com/search";

const NUTRIENT_ENERGY = 1008;  // kcal per 100g
const NUTRIENT_PROTEIN = 1003; // g per 100g
const NUTRIENT_CARBS = 1005;   // g per 100g
const NUTRIENT_FAT = 1004;     // g per 100g

export type NutritionSearchResult =
  | { found: true; name: string; per100g: { calories: number; protein: number; carbs: number; fat: number } }
  | { found: false };

export async function searchNutrition(query: string): Promise<NutritionSearchResult> {
  const apiKey = process.env.USDA_API_KEY ?? "DEMO_KEY";
  const url = `${USDA_BASE}?query=${encodeURIComponent(query)}&api_key=${apiKey}&dataType=Foundation,SR%20Legacy&pageSize=3`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.warn(`[nutrition-api] USDA error: ${res.status}`);
      return { found: false };
    }
    const data = await res.json();
    const food = data.foods?.[0];
    if (!food) return { found: false };

    const getNutrient = (id: number): number => {
      const n = (food.foodNutrients as { nutrientId: number; value: number }[])?.find(
        (n) => n.nutrientId === id
      );
      return Math.round((n?.value ?? 0) * 10) / 10;
    };

    return {
      found: true,
      name: food.description as string,
      per100g: {
        calories: getNutrient(NUTRIENT_ENERGY),
        protein: getNutrient(NUTRIENT_PROTEIN),
        carbs: getNutrient(NUTRIENT_CARBS),
        fat: getNutrient(NUTRIENT_FAT),
      },
    };
  } catch (err) {
    console.warn("[nutrition-api] searchNutrition failed:", err);
    return { found: false };
  }
}

export async function searchWeb(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[nutrition-api] TAVILY_API_KEY not set — web search unavailable");
    return "";
  }

  try {
    const res = await fetch(TAVILY_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: true,
      }),
    });
    if (!res.ok) {
      console.warn(`[nutrition-api] Tavily error: ${res.status}`);
      return "";
    }
    const data = await res.json();
    if (data.answer) return data.answer as string;
    const contents = ((data.results ?? []) as { content: string }[])
      .map((r) => r.content)
      .join("\n\n");
    return contents.slice(0, 1500);
  } catch (err) {
    console.warn("[nutrition-api] searchWeb failed:", err);
    return "";
  }
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 new errors. Pre-existing errors in other files are fine.

- [ ] **Step 5: Smoke-test `searchNutrition` with curl**

With the dev server NOT required — just test the USDA API directly to confirm `DEMO_KEY` works:

```bash
curl "https://api.nal.usda.gov/fdc/v1/foods/search?query=chicken+breast&api_key=DEMO_KEY&dataType=Foundation,SR%20Legacy&pageSize=1"
```

Expected: JSON with `foods[0].description` containing "chicken" and `foods[0].foodNutrients` containing entries with `nutrientId` 1003 (protein), 1004 (fat), 1005 (carbs), 1008 (energy).

- [ ] **Step 6: Commit**

```bash
git add lib/nutrition-api.ts .env.example
git commit -m "feat: add searchNutrition (USDA) and searchWeb (Tavily) in lib/nutrition-api.ts"
```

---

## Task 2: Update `buildNutritionChatPrompt` in `lib/ai.ts`

**Files:**
- Modify: `lib/ai.ts` (function `buildNutritionChatPrompt`, around line 354–381)

The current system prompt ends with:
```
- Estimate macros accurately from the food description using your knowledge. Be realistic, not conservative.
- Do not include markdown in "reply" — plain text only.`;
```

Replace those two final bullet lines and the closing template literal with the updated version below.

- [ ] **Step 1: Update the system prompt in `buildNutritionChatPrompt`**

Find this block in `lib/ai.ts` (lines 377–381):

```typescript
- Estimate macros accurately from the food description using your knowledge. Be realistic, not conservative.
- Do not include markdown in "reply" — plain text only.`;

  return { system };
}
```

Replace with:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ai.ts
git commit -m "feat: add tool use strategy instructions to buildNutritionChatPrompt"
```

---

## Task 3: Rewrite chat route with tool use loop

**Files:**
- Modify: `app/api/nutrition/chat/route.ts`

This is a full replacement of the file. The existing logic (DB queries, slot validation, entry saving, chat saving) is preserved — only the Claude call is replaced with a tool use loop.

- [ ] **Step 1: Replace `app/api/nutrition/chat/route.ts` with the new implementation**

Read the current file first, then replace the entire contents:

```typescript
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { anthropic, buildNutritionChatPrompt } from "@/lib/ai";
import { searchNutrition, searchWeb } from "@/lib/nutrition-api";
import type { NutritionChat } from "@prisma/client";

const VALID_SLOTS = new Set(["breakfast", "lunch", "dinner", "snack"]);
const MAX_TOOL_ROUNDS = 8;

const tools: Anthropic.Tool[] = [
  {
    name: "search_nutrition",
    description:
      "Search the USDA FoodData Central database for a food item. Returns macros per 100g. Use this for every food item you identify before estimating. Search one food at a time.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Food name to search, e.g. 'chicken breast' or 'cooked white rice'. One food at a time — keep it simple.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_web",
    description:
      "Search the web for information about a restaurant dish or complex meal — typical ingredients and portion sizes in grams. Use this when search_nutrition returns nothing useful. Then call search_nutrition for each ingredient found.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query, e.g. 'hibachi steak shrimp restaurant typical ingredients portion sizes grams'.",
        },
      },
      required: ["query"],
    },
  },
];

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
    return NextResponse.json(
      { error: "No profile found. Please set up your profile first." },
      { status: 400 }
    );
  }

  const { system } = buildNutritionChatPrompt({ profile, entries, foodItems, date });

  let messages: Anthropic.MessageParam[] = [
    ...chatHistory.map((m: NutritionChat) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  try {
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system,
      tools,
      messages,
    });

    let rounds = 0;
    while (response.stop_reason === "tool_use" && rounds < MAX_TOOL_ROUNDS) {
      rounds++;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          let resultContent: string;

          if (block.name === "search_nutrition") {
            const input = block.input as { query: string };
            const result = await searchNutrition(input.query);
            resultContent = JSON.stringify(result);
          } else if (block.name === "search_web") {
            const input = block.input as { query: string };
            const text = await searchWeb(input.query);
            resultContent = text || "No results found.";
          } else {
            resultContent = "Unknown tool.";
          }

          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: resultContent,
          };
        })
      );

      messages = [
        ...messages,
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: toolResults },
      ];

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system,
        tools,
        messages,
      });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "{}";

    let reply = "";
    let parsedEntries: Array<{
      description: string;
      slot: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }> = [];

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        reply = parsed.reply?.trim() || text;
        parsedEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
      } else {
        reply = text;
      }
    } catch {
      reply = text;
    }

    const createdEntries = await Promise.all(
      parsedEntries.map((e) =>
        db.nutritionEntry.create({
          data: {
            date,
            slot: VALID_SLOTS.has(e.slot) ? e.slot : "snack",
            description: e.description,
            calories: Math.max(0, Number(e.calories) || 0),
            protein: Math.max(0, Number(e.protein) || 0),
            carbs: Math.max(0, Number(e.carbs) || 0),
            fat: Math.max(0, Number(e.fat) || 0),
            source: "ai",
          },
        })
      )
    );

    await db.nutritionChat.createMany({
      data: [
        { date, role: "user", content: message },
        { date, role: "assistant", content: reply },
      ],
    });

    return NextResponse.json({ reply, newEntries: createdEntries });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to get AI response. Check ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 new errors. All pre-existing errors remain in other files only.

- [ ] **Step 3: End-to-end test with the dev server**

Start the dev server: `npm run dev`

Open http://localhost:3000/meals and send a message describing food. Test two cases:

**Case A — measured home meal:**
Type: `I had 200g chicken breast and 150g cooked brown rice for lunch`

Expected in browser console (dev tools → Network → the `/api/nutrition/chat` request):
- Multiple tool calls visible in the response time (takes 3–6 seconds instead of 1–2)
- The logged entry shows protein close to the actual value (~62g protein for 200g chicken breast, ~3g for rice)

**Case B — restaurant meal:**
Type: `I had hibachi steak and shrimp for dinner`

Expected: Claude calls `search_web` first, then multiple `search_nutrition` calls for the components, then produces the entries.

- [ ] **Step 4: Commit**

```bash
git add app/api/nutrition/chat/route.ts
git commit -m "feat: add USDA + Tavily tool use loop to nutrition chat endpoint"
```

- [ ] **Step 5: Push**

```bash
git push
```

---

## Self-Review

**Spec coverage:**
- [x] `searchNutrition(query)` function — Task 1
- [x] `searchWeb(query)` function — Task 1
- [x] USDA endpoint with `dataType=Foundation,SR Legacy` — Task 1
- [x] Tavily `include_answer: true`, fallback to `results[].content` — Task 1
- [x] Missing env var handling — Task 1 (`DEMO_KEY` fallback for USDA, warn + empty string for Tavily)
- [x] Tool definitions for both tools — Task 3
- [x] Tool use loop with `MAX_TOOL_ROUNDS = 8` — Task 3
- [x] Parallel tool execution with `Promise.all` — Task 3
- [x] `max_tokens` raised to 4096 — Task 3
- [x] System prompt tool strategy instructions — Task 2
- [x] Per-100g scaling instructions with reference amounts — Task 2
- [x] Web search fallback strategy for restaurant dishes — Task 2
- [x] All existing logic preserved (slot validation, macro sanitization, entry/chat saving) — Task 3
- [x] `.env.example` created — Task 1
- [x] No frontend changes — confirmed, `app/meals/page.tsx` untouched

**No placeholders:** All code blocks are complete.

**Type consistency:** `NutritionSearchResult` defined in Task 1 is not imported in later tasks — it's only used internally by `searchNutrition`. `Anthropic.Tool`, `Anthropic.MessageParam`, `Anthropic.ToolUseBlock`, `Anthropic.ToolResultBlockParam` — all from `@anthropic-ai/sdk`, imported as `Anthropic` in Task 3.
