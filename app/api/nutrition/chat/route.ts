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
