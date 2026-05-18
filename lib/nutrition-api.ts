const USDA_BASE = "https://api.nal.usda.gov/fdc/v1/foods/search";
const TAVILY_BASE = "https://api.tavily.com/search";

const NUTRIENT_ENERGY = 1008;  // kcal per 100g
const NUTRIENT_PROTEIN = 1003; // g per 100g
const NUTRIENT_CARBS = 1005;   // g per 100g
const NUTRIENT_FAT = 1004;     // g per 100g

const nutritionCache = new Map<string, { ts: number; result: NutritionSearchResult }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export type NutritionSearchResult =
  | { found: true; name: string; per100g: { calories: number; protein: number; carbs: number; fat: number } }
  | { found: false };

export async function searchNutrition(query: string): Promise<NutritionSearchResult> {
  const cacheKey = query.trim().toLowerCase();
  const cached = nutritionCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.result;

  const apiKey = process.env.USDA_API_KEY ?? "DEMO_KEY";
  const url = `${USDA_BASE}?query=${encodeURIComponent(query)}&api_key=${apiKey}&dataType=Foundation,SR%20Legacy&pageSize=3`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[nutrition-api] USDA error: ${res.status}`);
      return { found: false };
    }
    const data = await res.json();
    const food = data.foods?.[0];
    if (!food) return { found: false };
    if (!Array.isArray(food.foodNutrients)) return { found: false };

    const getNutrient = (id: number): number => {
      const n = (food.foodNutrients as { nutrientId: number; value: number }[])?.find(
        (n) => n.nutrientId === id
      );
      const raw = n?.value;
      return Math.round((Number.isFinite(raw) ? Math.max(0, raw as number) : 0) * 10) / 10;
    };

    const result = {
      found: true,
      name: food.description as string,
      per100g: {
        calories: getNutrient(NUTRIENT_ENERGY),
        protein: getNutrient(NUTRIENT_PROTEIN),
        carbs: getNutrient(NUTRIENT_CARBS),
        fat: getNutrient(NUTRIENT_FAT),
      },
    };
    nutritionCache.set(cacheKey, { ts: Date.now(), result });
    return result;
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
    if (typeof data.answer === "string" && data.answer) return data.answer;
    const contents = ((data.results ?? []) as { content: string }[])
      .map((r) => r.content)
      .join("\n\n");
    const raw = contents.slice(0, 1500);
    return (raw.slice(0, raw.lastIndexOf(" ") + 1).trimEnd() || raw);
  } catch (err) {
    console.warn("[nutrition-api] searchWeb failed:", err);
    return "";
  }
}
