import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { anthropic, buildNutritionChatPrompt } from "@/lib/ai";
import { searchNutrition, searchWeb } from "@/lib/nutrition-api";
import { getClientId } from "@/lib/client";
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
  const clientId = await getClientId();
  let date: string, message: string;
  try {
    ({ date, message } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!date || !message) {
    return NextResponse.json({ error: "date and message are required" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be in YYYY-MM-DD format" }, { status: 400 });
  }

  const [profile, entries, chatHistory, foodItems, client] = await Promise.all([
    db.userProfile.findUnique({ where: { clientId } }),
    db.nutritionEntry.findMany({ where: { clientId, date }, orderBy: { createdAt: "asc" } }),
    db.nutritionChat.findMany({ where: { clientId, date }, orderBy: { createdAt: "asc" } }),
    db.foodItem.findMany(),
    db.client.findUniqueOrThrow({ where: { id: clientId }, select: { persona: true } }),
  ]);

  if (!profile) {
    return NextResponse.json(
      { error: "No profile found. Please set up your profile first." },
      { status: 400 }
    );
  }

  const { system } = buildNutritionChatPrompt({ profile, entries, foodItems, date, persona: client.persona });

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

          const inputQuery =
            typeof block.input === "object" &&
            block.input !== null &&
            typeof (block.input as Record<string, unknown>).query === "string"
              ? ((block.input as Record<string, unknown>).query as string).trim()
              : "";

          if (block.name === "search_nutrition") {
            if (!inputQuery) {
              resultContent = JSON.stringify({ found: false });
            } else {
              const result = await searchNutrition(inputQuery);
              resultContent = JSON.stringify(result);
            }
          } else if (block.name === "search_web") {
            if (!inputQuery) {
              resultContent = "No results found.";
            } else {
              const text = await searchWeb(inputQuery);
              resultContent = text || "No results found.";
            }
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

    if (response.stop_reason === "tool_use") {
      console.warn("[nutrition-chat] MAX_TOOL_ROUNDS reached without final text response");
      return NextResponse.json(
        { error: "Could not complete nutrition lookup. Please try rephrasing your message." },
        { status: 500 }
      );
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.warn("[nutrition-chat] No text block in final Claude response");
      return NextResponse.json(
        { error: "Received an unexpected response. Please try again." },
        { status: 500 }
      );
    }
    const text = textBlock.text;

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
            clientId,
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
        { clientId, date, role: "user", content: message },
        { clientId, date, role: "assistant", content: reply },
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
