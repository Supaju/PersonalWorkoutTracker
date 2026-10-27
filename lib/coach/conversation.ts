// Coach conversation: one persistent thread per client. The model routes through tools; this file runs the tool loop,
// persists both messages, and records what the coach did as a CoachAction on the assistant message.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAnthropic } from "./anthropic";
import { MODELS, PHILOSOPHY } from "./philosophy";
import { CheckInInput, CoachAction } from "./schemas";
import { planSession, refinePlan, reviewSession, answerQuestion, research } from "./engine";
import { runProgramReview } from "./program-review";
import { createCheckIn, getToday, localDate } from "./today";

const MAX_ITERATIONS = 6;

// ─── Tools ───────────────────────────────────────────────────────────────────

type Ctx = { clientId: string; sessionId?: string };
type ToolOut = { result: unknown; action?: CoachAction; proposalId?: string };

const Kind = z.enum(["disliked", "preferred", "substitute"]);
const TOOLS: Record<string, { description: string; schema: z.ZodType; run: (c: Ctx, i: never) => Promise<ToolOut> }> = {
  plan_today: {
    description: "Create today's workout plan. Pass checkIn if the client just described sleep, soreness, energy or available minutes.",
    schema: z.object({ checkIn: CheckInInput.optional() }),
    run: async (c, i: { checkIn?: CheckInInput }) => {
      const date = localDate();
      const checkInId = i.checkIn ? (await createCheckIn(c.clientId, { ...i.checkIn, kind: "pre", date })).id : undefined;
      const { sessionId, plan } = await planSession(c.clientId, { date, checkInId });
      return { result: { sessionId, plan }, action: { type: "plan_created", sessionId } };
    },
  },
  refine_plan: {
    description: "Change an existing planned session (swap, drop, shorten, add) based on what the client asked.",
    schema: z.object({ sessionId: z.string(), message: z.string() }),
    run: async (c, i: { sessionId: string; message: string }) => {
      await owned(c.clientId, i.sessionId);
      const { plan, reply } = await refinePlan(c.clientId, i.sessionId, i.message);
      return { result: { reply, plan }, action: { type: "plan_updated", sessionId: i.sessionId } };
    },
  },
  save_preference: {
    description: "Remember an exercise preference the client stated (dislike, favorite, or a substitute for another exercise).",
    schema: z.object({ exerciseName: z.string(), kind: Kind, substituteFor: z.string().optional(), note: z.string().optional() }),
    run: async (c, i: { exerciseName: string; kind: z.infer<typeof Kind>; substituteFor?: string; note?: string }) => {
      const row = await db.exercisePreference.upsert({
        where: { clientId_exerciseName_kind: { clientId: c.clientId, exerciseName: i.exerciseName, kind: i.kind } },
        create: { clientId: c.clientId, exerciseName: i.exerciseName, kind: i.kind, substituteFor: i.substituteFor ?? null, note: i.note ?? null },
        update: { substituteFor: i.substituteFor ?? null, note: i.note ?? null },
      });
      return { result: { saved: true, id: row.id }, action: { type: "preference_saved", preferenceId: row.id, exerciseName: row.exerciseName, kind: row.kind } };
    },
  },
  save_consideration: {
    description: "Remember a lasting fact about the client that affects programming (injury, medical, body size, equipment limits).",
    schema: z.object({ category: z.enum(["body_size", "injury", "medical", "equipment", "other"]), text: z.string() }),
    run: async (c, i: { category: string; text: string }) => {
      const row = await db.clientConsideration.create({ data: { clientId: c.clientId, category: i.category, text: i.text } });
      return { result: { saved: true, id: row.id }, action: { type: "consideration_saved", considerationId: row.id } };
    },
  },
  update_schedule: {
    description: "Change the client's training days (0=Sun..6=Sat) and/or default session minutes.",
    schema: z.object({ trainingDays: z.array(z.number().int().min(0).max(6)).optional(), defaultMinutes: z.number().int().positive().optional() }),
    run: async (c, i: { trainingDays?: number[]; defaultMinutes?: number }) => {
      await db.client.update({
        where: { id: c.clientId },
        data: { ...(i.trainingDays && { trainingDays: JSON.stringify(i.trainingDays) }), ...(i.defaultMinutes && { defaultMinutes: i.defaultMinutes }) },
      });
      return { result: { saved: true }, action: { type: "schedule_updated" } };
    },
  },
  save_checkin: {
    description: "Record a check-in (pre-session readiness, post-session check-out, or next-day soreness) the client described.",
    schema: CheckInInput,
    run: async (c, i: CheckInInput) => {
      if (i.sessionId) await owned(c.clientId, i.sessionId);
      const row = await createCheckIn(c.clientId, i);
      return { result: { saved: true, id: row.id }, action: { type: "checkin_saved", checkInId: row.id } };
    },
  },
  review_session: {
    description: "Review a recorded session and produce next-time progressions and any clarifying questions.",
    schema: z.object({ sessionId: z.string() }),
    run: async (c, i: { sessionId: string }) => {
      await owned(c.clientId, i.sessionId);
      const review = await reviewSession(c.clientId, i.sessionId);
      return { result: review, action: { type: "review_created", sessionId: i.sessionId } };
    },
  },
  answer_question: {
    description: "Submit the client's answer to one of your pending clarifying questions.",
    schema: z.object({ questionId: z.string(), answer: z.string() }),
    run: async (c, i: { questionId: string; answer: string }) => {
      const q = await db.clarifyingQuestion.findFirst({ where: { id: i.questionId, session: { clientId: c.clientId } }, select: { id: true } });
      if (!q) throw new Error("Question not found");
      return { result: await answerQuestion(c.clientId, i.questionId, i.answer) }; // no CoachAction variant exists for this
    },
  },
  start_program_review: {
    description: "Start a review of the whole program. Use for any structural change (phase, split, frequency); never change structure silently.",
    schema: z.object({}),
    run: async (c) => {
      const r = await runProgramReview(c.clientId, { today: localDate(), clientRequested: true });
      return r.proposalId
        ? { result: r, proposalId: r.proposalId, action: { type: "proposal_created", proposalId: r.proposalId } }
        : { result: r };
    },
  },
  research: {
    description: "Look up evidence for a training question. Never use for medical problems; recommend a doctor instead.",
    schema: z.object({ question: z.string() }),
    run: async (c, i: { question: string }) => {
      const r = await research(c.clientId, i.question, { sessionId: c.sessionId });
      return { result: r, ...(r.researchNoteId && { action: { type: "research_saved", researchNoteId: r.researchNoteId } as CoachAction }) };
    },
  },
};

async function owned(clientId: string, sessionId: string) {
  const s = await db.workoutSession.findFirst({ where: { id: sessionId, clientId }, select: { id: true } });
  if (!s) throw new Error("Session not found");
}

const toolDefs = Object.entries(TOOLS).map(([name, t]) => {
  const { $schema: _s, ...input_schema } = z.toJSONSchema(t.schema) as Record<string, unknown>;
  return { name, description: t.description, input_schema } as Anthropic.Tool;
});

// ─── Context ─────────────────────────────────────────────────────────────────

async function buildSystem(clientId: string): Promise<string> {
  const [client, considerations, prefs] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: clientId }, include: { profile: true } }),
    db.clientConsideration.findMany({ where: { clientId, active: true } }),
    db.exercisePreference.findMany({ where: { clientId } }),
  ]);
  let today = "unavailable";
  try {
    const t = await getToday(clientId);
    today = JSON.stringify({
      date: t.date, isTrainingDay: t.isTrainingDay, suggestedSessionType: t.suggestedSessionType, reasons: t.reasons,
      activeSession: t.activeSession, plannedSession: t.plannedSession, lastSession: t.lastSession,
      pendingQuestions: t.pendingQuestions.map((q) => ({ id: q.id, question: q.question })),
      pendingProposals: t.pendingProposals.map((p) => p.id), needsNextDayCheck: t.needsNextDayCheck,
    });
  } catch { /* rules not available: converse without the summary */ }

  const p = client.profile;
  return [
    `You are the personal trainer for ${client.name}. Persona: ${client.persona}`,
    p && `Client: ${p.age}y ${p.gender}, ${p.weightLbs} lb, goals: ${p.goals}${p.goalNotes ? ` (${p.goalNotes})` : ""}.`,
    `Training days (0=Sun): ${client.trainingDays}. Default session ${client.defaultMinutes} min, hard cap ${client.hardCapMinutes}.`,
    `Voice:\n- ${PHILOSOPHY.voice.join("\n- ")}`,
    `Safety:\n- ${PHILOSOPHY.safety.join("\n- ")}`,
    `Considerations:\n${considerations.map((c) => `- [${c.category}] ${c.text}`).join("\n") || "- none"}`,
    `Exercise preferences:\n${prefs.map((x) => `- ${x.kind}: ${x.exerciseName}${x.substituteFor ? ` (instead of ${x.substituteFor})` : ""}`).join("\n") || "- none"}`,
    `Today: ${today}`,
    [
      "Rules:",
      "- Save any preference the client states (e.g. 'he hates X') with save_preference and confirm it.",
      "- Respect the time budget.",
      "- Structural program changes go through start_program_review, never silent.",
      "- Use tools for actions; reply in plain short text. Do not invent session ids; use ids from Today.",
    ].join("\n"),
  ].filter(Boolean).join("\n\n");
}

const LABEL: Record<CoachAction["type"], string> = {
  plan_created: "created today's plan", plan_updated: "updated the plan", preference_saved: "saved a preference",
  schedule_updated: "updated your schedule", consideration_saved: "saved a note about you", review_created: "reviewed the session",
  proposal_created: "started a program review", research_saved: "saved a research note", checkin_saved: "saved your check-in",
};

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function handleMessage(clientId: string, text: string, opts?: { sessionId?: string }) {
  const sessionId = opts?.sessionId;
  const userMsg = await db.coachMessage.create({ data: { clientId, role: "user", content: text, sessionId: sessionId ?? null } });

  const [system, recent] = await Promise.all([
    buildSystem(clientId),
    db.coachMessage.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const history = recent.reverse();
  while (history.length && history[0].role !== "user") history.shift();
  const msgs: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const actions: CoachAction[] = [];
  let proposalId: string | null = null;
  let finalText = "";
  const ctx: Ctx = { clientId, sessionId };

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await getAnthropic().messages.create({
      model: MODELS.routine,
      max_tokens: 2048,
      system,
      tools: toolDefs,
      tool_choice: { type: "auto" },
      output_config: { effort: "medium" },
      messages: msgs,
    });
    finalText = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (res.stop_reason !== "tool_use") break;

    msgs.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const tool = TOOLS[block.name];
      try {
        if (!tool) throw new Error(`Unknown tool ${block.name}`);
        const input = tool.schema.parse(block.input);
        const out = await tool.run(ctx, input as never);
        if (out.action) actions.push(out.action);
        if (out.proposalId) proposalId = out.proposalId;
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out.result) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: e instanceof Error ? e.message : String(e) });
      }
    }
    msgs.push({ role: "user", content: results });
  }

  const last = actions.at(-1);
  const others = [...new Set(actions.slice(0, -1).map((a) => LABEL[a.type]))];
  let content = finalText || (last ? `Done: ${LABEL[last.type]}.` : "Sorry, I could not finish that. Please try again.");
  if (others.length) content += `\n\n(Also ${others.join(", ")}.)`;

  const assistant = await db.coachMessage.create({
    data: { clientId, role: "assistant", content, action: last ? JSON.stringify(last) : null, sessionId: sessionId ?? null, proposalId },
  });
  return { messages: [userMsg, assistant] };
}
