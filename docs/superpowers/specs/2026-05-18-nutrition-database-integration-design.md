# Nutrition Database Integration — Design Spec

**Goal:** Replace Claude's pure estimation of food macros with grounded USDA data and web research, while preserving the conversational interface and handling both measured home meals and restaurant dishes.

**Architecture:** Two tools added to the chat endpoint — `search_nutrition` (USDA FoodData Central) and `search_web` (Tavily). The chat route runs a tool use loop until Claude produces its final reply. A new `lib/nutrition-api.ts` module owns the fetch logic. No frontend or schema changes.

**Tech Stack:** Next.js 15 App Router, Anthropic Claude API tool use, USDA FoodData Central API (free), Tavily Search API (free tier).

---

## New Environment Variables

Add to `.env.local` and document in `.env.example`:

```
USDA_API_KEY=your_key_here        # free at https://fdc.nal.usda.gov/api-guide.html (or use DEMO_KEY for testing — 40 req/day limit)
TAVILY_API_KEY=your_key_here      # free at https://tavily.com (1,000 req/month)
```

`DEMO_KEY` works without registration and can be used during development. Register for a free key to get 1,000 req/day.

---

## New File: `lib/nutrition-api.ts`

Two exported functions, no side effects, no Prisma.

### `searchNutrition(query: string): Promise<NutritionSearchResult>`

Calls USDA FoodData Central search endpoint.

```
GET https://api.nal.usda.gov/fdc/v1/foods/search
  ?query=<query>
  &api_key=<USDA_API_KEY>
  &dataType=Foundation,SR%20Legacy
  &pageSize=3
```

Response parsing:
- Take `foods[0]` (top result)
- Extract nutrient values by nutrient ID:
  - `1008` → calories (kcal per 100g)
  - `1003` → protein (g per 100g)
  - `1005` → carbohydrates (g per 100g)
  - `1004` → total fat (g per 100g)
- Return matched food description as `name`

Return type:

```typescript
type NutritionSearchResult =
  | { found: true; name: string; per100g: { calories: number; protein: number; carbs: number; fat: number } }
  | { found: false };
```

If `foods` array is empty or any nutrient lookup fails, return `{ found: false }`.

### `searchWeb(query: string): Promise<string>`

Calls Tavily search API.

```
POST https://api.tavily.com/search
Content-Type: application/json

{
  "api_key": "<TAVILY_API_KEY>",
  "query": "<query>",
  "search_depth": "basic",
  "max_results": 5,
  "include_answer": true
}
```

Return the `answer` field if present, otherwise concatenate `results[].content` (up to 1500 characters total). Return a plain string. If the request fails, return an empty string (Claude will fall back to estimation).

---

## Modified: `app/api/nutrition/chat/route.ts`

### Tool definitions

Add two tools to pass to `anthropic.messages.create`:

```typescript
const tools = [
  {
    name: "search_nutrition",
    description:
      "Search the USDA FoodData Central database for a food item. Returns macros per 100g. Use this for every food item you identify before estimating. If the result is 'found: false', fall back to search_web or estimation.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Food name to search, e.g. 'chicken breast' or 'cooked white rice'. Keep it simple — one food at a time.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_web",
    description:
      "Search the web for information about a restaurant dish or meal — typical ingredients, portion sizes in grams. Use this when search_nutrition returns nothing useful for a complex dish. Then call search_nutrition for each ingredient found.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query, e.g. 'hibachi steak shrimp restaurant typical ingredients portion sizes grams'.",
        },
      },
      required: ["query"],
    },
  },
];
```

### Tool use loop

Replace the current single `anthropic.messages.create` call with a loop:

```typescript
const MAX_TOOL_ROUNDS = 8; // prevent infinite loops

let messages = [
  ...chatHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  { role: "user" as const, content: message },
];

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

  // Collect all tool_use blocks from this response
  const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

  // Execute all tool calls (can be parallel)
  const toolResults = await Promise.all(
    toolUseBlocks.map(async (block) => {
      if (block.type !== "tool_use") return null;
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

  // Append assistant turn + tool results to messages
  messages = [
    ...messages,
    { role: "assistant" as const, content: response.content },
    { role: "user" as const, content: toolResults.filter(Boolean) },
  ];

  response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system,
    tools,
    messages,
  });
}

// Extract final text response (same parsing logic as before)
const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
```

`max_tokens` raised from 1024 to 4096 to accommodate tool use turns and reasoning.

### Imports

Add to top of chat route:

```typescript
import { searchNutrition, searchWeb } from "@/lib/nutrition-api";
```

---

## Modified: `lib/ai.ts` — `buildNutritionChatPrompt`

Add tool use instructions to the system prompt (append after existing rules):

```
Tool use strategy:
- Call search_nutrition for EVERY food item you can identify in the user's message before producing entries.
- USDA returns values per 100g. Estimate the quantity in grams from context ("a large chicken breast" ≈ 180g, "1 cup cooked rice" ≈ 200g) and scale: (quantity_g / 100) × per100g value.
- If search_nutrition returns { "found": false } for a dish (e.g. a restaurant meal), call search_web with a query like "<dish name> typical ingredients portion sizes grams", then call search_nutrition for each ingredient returned.
- Only fall back to pure estimation if both tools return no usable data.
- You may call search_nutrition multiple times in one turn (once per food item). This is expected and correct.
```

---

## Error Handling

- USDA API unreachable → `searchNutrition` returns `{ found: false }` → Claude falls back to estimation. No crash.
- Tavily API unreachable → `searchWeb` returns `""` → Claude falls back to estimation. No crash.
- Tool use loop hits `MAX_TOOL_ROUNDS` → loop exits, Claude's last response is parsed as-is. Entries may be partially estimated.
- Missing env vars → `searchNutrition` logs a console warning and returns `{ found: false }`; `searchWeb` logs and returns `""`. Claude falls back to estimation in both cases.

---

## What Does NOT Change

- `NutritionEntry` schema — same fields, same shape
- All other API routes
- `app/meals/page.tsx` — no frontend changes
- `GET /api/nutrition` — unchanged
- Food library — still used by Claude for suggestions

---

## Out of Scope

- Caching USDA results (can be added later if rate limits become an issue)
- Showing the user which source (USDA vs estimated) was used for each entry
- Editing the USDA query if Claude picks the wrong food
