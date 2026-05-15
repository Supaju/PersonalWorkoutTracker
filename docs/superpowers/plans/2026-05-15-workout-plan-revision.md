# Workout Plan Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Revise with AI" slide-in drawer to the plan page so the user can give conversational feedback on a generated workout, see a diff of proposed changes, and accept or reject them before saving.

**Architecture:** A new `POST /api/sessions/plan/refine` endpoint receives the conversation history and current exercises, replays the original plan prompt as a multi-turn Claude conversation, and returns a plain-English reply plus a revised exercise list. A `PlanReviseDrawer` component renders the chat thread and diff table. The full conversation is saved to a new `planningChat` field on `WorkoutSession` when the session is created.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma + SQLite, Anthropic SDK (`claude-sonnet-4-6`), Tailwind CSS v4 with `var(--color-*)` tokens.

---

## File Structure

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `planningChat String?` to `WorkoutSession` |
| `lib/types.ts` | Add `Message` type |
| `lib/ai-config.ts` | Add `refine` section to `AI_CONFIG` |
| `lib/ai.ts` | Add `buildRefinePrompt()` |
| `app/api/sessions/plan/refine/route.ts` | **New** — POST endpoint for revision requests |
| `components/PlanReviseDrawer.tsx` | **New** — drawer with chat thread + diff view |
| `app/sessions/plan/page.tsx` | Add drawer state, "Revise with AI" button, wire onApply + planningChat save |
| `app/api/sessions/route.ts` | Accept `planningChat` in POST body and persist it |

---

## Task 1: Schema, Types, and AI Config

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/types.ts`
- Modify: `lib/ai-config.ts`
- Modify: `lib/ai.ts`

- [ ] **Step 1: Add `planningChat` field to `WorkoutSession` in `prisma/schema.prisma`**

Find the `WorkoutSession` model and add one line after `notes String?`:

```prisma
model WorkoutSession {
  id          String            @id @default(cuid())
  date        String
  template    String
  phase       String            @default("planned")
  durationMin Int?
  notes       String?
  planningChat String?
  exercises   SessionExercise[]
  createdAt   DateTime          @default(now())
}
```

- [ ] **Step 2: Run the Prisma migration**

```bash
npx prisma migrate dev --name add_planning_chat
```

Expected output includes: `The following migration(s) have been created and applied from new schema changes: db/migrations/..._add_planning_chat`

- [ ] **Step 3: Add `Message` type to `lib/types.ts`**

Append to the end of `lib/types.ts`:

```typescript
export type Message = { role: "user" | "assistant"; content: string };
```

- [ ] **Step 4: Add `refine` section to `AI_CONFIG` in `lib/ai-config.ts`**

Add the `refine` key inside the `AI_CONFIG` object, after the `nutrition` block:

```typescript
  refine: {
    // Instruction appended to the system prompt for the revision endpoint.
    // Claude must return JSON with a "reply" (explanation) and full "exercises" list.
    instruction: `You are revising a workout plan based on user feedback. Return ONLY valid JSON in this exact format: { "reply": "...", "exercises": [...] }. In "reply", explain in 2-4 sentences exactly what you changed and why. In "exercises", return the COMPLETE updated list — include every exercise, including unchanged ones, with all original fields intact (slot, muscleGroups, aiNotes, etc.).`,
  },
```

- [ ] **Step 5: Add `buildRefinePrompt()` to `lib/ai.ts`**

Add after the existing `buildReviewPrompt` function at the bottom of `lib/ai.ts`:

```typescript
// ---- Refine prompt ----

export function buildRefinePrompt(): string {
  return `You are an expert personal trainer and exercise scientist. ${AI_CONFIG.persona}\n\n${AI_CONFIG.refine.instruction}`;
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "implicitly has an 'any'"
```

Expected: no new errors (the existing 36 implicit-any errors in callbacks are pre-existing and can be ignored).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ lib/types.ts lib/ai-config.ts lib/ai.ts
git commit -m "feat: schema migration, Message type, refine AI config and prompt"
```

---

## Task 2: Refine API Endpoint

**Files:**
- Create: `app/api/sessions/plan/refine/route.ts`

- [ ] **Step 1: Create the directory and route file**

Create `app/api/sessions/plan/refine/route.ts` with this content:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropic, buildPlanPrompt, buildRefinePrompt } from "@/lib/ai";
import type { TemplateId } from "@/lib/templates";
import type { PlannedExercise, Message } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { template, currentExercises, initialPlanJson, messages, userMessage } = body as {
      template: TemplateId;
      currentExercises: PlannedExercise[];
      initialPlanJson: string;
      messages: Message[];
      userMessage: string;
    };

    const profile = await db.userProfile.findFirst();
    if (!profile) {
      return NextResponse.json({ error: "No profile found." }, { status: 400 });
    }

    const [equipment, allSessions] = await Promise.all([
      db.equipment.findMany(),
      db.workoutSession.findMany({
        include: { exercises: { include: { sets: true }, orderBy: { orderIndex: "asc" } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const lastSameSession =
      allSessions.find((s) => s.template === template && s.phase === "recorded") ?? null;
    const lastAlternateLower =
      template === "lower_a"
        ? (allSessions.find((s) => s.template === "lower_b" && s.phase === "recorded") ?? null)
        : template === "lower_b"
        ? (allSessions.find((s) => s.template === "lower_a" && s.phase === "recorded") ?? null)
        : null;

    const planPrompt = buildPlanPrompt({
      profile,
      equipment,
      template,
      lastSameSession,
      lastAlternateLowerSession: lastAlternateLower,
    });

    const claudeMessages: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: planPrompt.user },
      { role: "assistant", content: initialPlanJson },
      ...messages,
      {
        role: "user",
        content: `${userMessage}\n\nCurrent exercise list for reference:\n${JSON.stringify(currentExercises, null, 2)}`,
      },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: buildRefinePrompt(),
      messages: claudeMessages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    if (!result.reply || !Array.isArray(result.exercises)) {
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 500 });
    }

    return NextResponse.json({ reply: result.reply, exercises: result.exercises });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to refine plan. Check ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "implicitly has an 'any'"
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/sessions/plan/refine/route.ts
git commit -m "feat: add POST /api/sessions/plan/refine endpoint"
```

---

## Task 3: PlanReviseDrawer Component

**Files:**
- Create: `components/PlanReviseDrawer.tsx`

- [ ] **Step 1: Create the drawer component**

Create `components/PlanReviseDrawer.tsx`:

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import type { PlannedExercise, Message } from "@/lib/types";
import type { TemplateId } from "@/lib/templates";

type Props = {
  open: boolean;
  template: TemplateId;
  currentExercises: PlannedExercise[];
  initialPlanJson: string;
  onApply: (exercises: PlannedExercise[], messages: Message[]) => void;
  onClose: () => void;
};

function isChanged(a: PlannedExercise, b: PlannedExercise): boolean {
  return (
    a.name !== b.name ||
    a.targetSets !== b.targetSets ||
    a.targetReps !== b.targetReps ||
    a.targetWeight !== b.targetWeight
  );
}

function changedFields(a: PlannedExercise, b: PlannedExercise): Set<string> {
  const fields = new Set<string>();
  if (a.name !== b.name) fields.add("name");
  if (a.targetSets !== b.targetSets) fields.add("targetSets");
  if (a.targetReps !== b.targetReps) fields.add("targetReps");
  if (a.targetWeight !== b.targetWeight) fields.add("targetWeight");
  return fields;
}

export function PlanReviseDrawer({
  open,
  template,
  currentExercises,
  initialPlanJson,
  onApply,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposedExercises, setProposedExercises] = useState<PlannedExercise[] | null>(null);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, proposedExercises]);

  const send = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText("");
    setError("");
    setSending(true);

    const newUserMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);

    try {
      const res = await fetch("/api/sessions/plan/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          currentExercises,
          initialPlanJson,
          messages,
          userMessage: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to get revision.");
        setMessages(messages);
        setSending(false);
        return;
      }
      const assistantMessage: Message = { role: "assistant", content: data.reply };
      setMessages([...updatedMessages, assistantMessage]);
      setProposedExercises(data.exercises);
    } catch {
      setError("Failed to connect.");
      setMessages(messages);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const acceptAll = () => {
    if (!proposedExercises) return;
    onApply(proposedExercises, messages);
    setProposedExercises(null);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-[480px] max-w-full bg-[var(--color-bg)] border-l border-[var(--color-border)] z-50 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-widest">
            Revise with AI
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {messages.length === 0 && (
            <p className="text-[var(--color-text-faint)] text-sm text-center mt-8 leading-relaxed">
              Tell Claude what to change.<br />
              <span className="text-xs opacity-70">
                e.g. "swap bench press for incline dumbbell" or "the row weight feels too high"
              </span>
            </p>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[var(--color-surface)] border border-[var(--color-accent)] text-[var(--color-text)]"
                    : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Diff table */}
          {proposedExercises && (
            <div className="mt-2">
              <p className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-2">
                Proposed Changes
              </p>
              <div className="border border-[var(--color-border)] overflow-hidden text-xs">
                {proposedExercises.map((proposed, i) => {
                  const current = currentExercises[i];
                  if (!current) return null;
                  const changed = isChanged(current, proposed);
                  const fields = changed ? changedFields(current, proposed) : new Set<string>();
                  return (
                    <div
                      key={i}
                      className={`px-3 py-2.5 border-b border-[var(--color-border)] last:border-0 ${
                        changed
                          ? "border-l-2 border-l-amber-500 bg-[var(--color-surface)]"
                          : "opacity-40"
                      }`}
                    >
                      <span
                        className={
                          fields.has("name")
                            ? "font-bold text-amber-400"
                            : "text-[var(--color-text)]"
                        }
                      >
                        {proposed.name}
                      </span>
                      <span className="text-[var(--color-text-faint)] ml-3">
                        <span className={fields.has("targetSets") ? "font-bold text-amber-400" : ""}>
                          {proposed.targetSets}
                        </span>
                        {" × "}
                        <span className={fields.has("targetReps") ? "font-bold text-amber-400" : ""}>
                          {proposed.targetReps}
                        </span>
                        {" @ "}
                        <span
                          className={fields.has("targetWeight") ? "font-bold text-amber-400" : ""}
                        >
                          {proposed.targetWeight != null ? `${proposed.targetWeight} lbs` : "BW"}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={acceptAll} className="btn-accent">
                  Accept All Changes
                </button>
                <button
                  onClick={() => setProposedExercises(null)}
                  className="px-4 py-2 text-xs border border-[var(--color-border)] text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] transition-colors uppercase tracking-widest font-bold"
                >
                  Keep Current
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-2 bg-[#1a0505] border-t border-[#3a1010] text-[#f87171] text-xs shrink-0">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] shrink-0">
          <div className="flex gap-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder="Tell Claude what to change..."
              rows={2}
              className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-accent)] resize-none disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={sending || !inputText.trim()}
              className="btn-accent px-4 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-faint)] mt-1.5">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "implicitly has an 'any'"
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/PlanReviseDrawer.tsx
git commit -m "feat: add PlanReviseDrawer component with chat thread and diff view"
```

---

## Task 4: Wire Plan Page + Update Sessions Route

**Files:**
- Modify: `app/sessions/plan/page.tsx`
- Modify: `app/api/sessions/route.ts`

- [ ] **Step 1: Update `app/sessions/plan/page.tsx`**

Replace the entire file with:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES, TEMPLATE_COLORS, CYCLE_ORDER, type TemplateId } from "@/lib/templates";
import type { AIPlanResponse, PlannedExercise, Message } from "@/lib/types";
import { PlanReviseDrawer } from "@/components/PlanReviseDrawer";

export default function PlanSessionPage() {
  const router = useRouter();
  const [suggestedTemplate, setSuggestedTemplate] = useState<TemplateId | null>(null);
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<AIPlanResponse | null>(null);
  const [exercises, setExercises] = useState<PlannedExercise[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [planningMessages, setPlanningMessages] = useState<Message[]>([]);
  const [initialPlanJson, setInitialPlanJson] = useState("");

  useEffect(() => {
    fetch("/api/cycle")
      .then((r) => r.json())
      .then((c) => {
        setSuggestedTemplate(c.currentTemplate);
        setTemplate(c.currentTemplate);
      });
  }, []);

  const selectTemplate = (t: TemplateId) => {
    if (t === template) return;
    setTemplate(t);
    setPlan(null);
    setExercises([]);
    setError("");
    setInitialPlanJson("");
    setPlanningMessages([]);
  };

  const generate = async () => {
    if (!template) return;
    setGenerating(true);
    setError("");
    setPlan(null);
    setInitialPlanJson("");
    setPlanningMessages([]);
    try {
      const res = await fetch("/api/sessions/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to generate plan."); setGenerating(false); return; }
      setPlan(data.plan);
      setExercises(data.plan.exercises);
      setInitialPlanJson(JSON.stringify(data.plan));
    } catch {
      setError("Failed to connect. Check ANTHROPIC_API_KEY in .env.local.");
    }
    setGenerating(false);
  };

  const updateExercise = (idx: number, field: keyof PlannedExercise, value: string | number | null) => {
    setExercises((prev) => prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex)));
  };

  const saveSession = async () => {
    if (!exercises.length || !template) return;
    setSaving(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        template,
        notes: plan?.sessionNotes ?? null,
        exercises: exercises.map((ex, i) => ({ ...ex, orderIndex: i })),
        planningChat: planningMessages.length > 0 ? JSON.stringify(planningMessages) : undefined,
      }),
    });
    const session = await res.json();
    router.push(`/sessions/${session.id}/record`);
  };

  const tmpl = template ? TEMPLATES[template] : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-2xl font-bold text-[var(--color-text)] uppercase tracking-wide">Plan Session</h2>
      </div>
      <p className="text-[var(--color-text-faint)] text-sm mb-6">Choose your workout type, then let Claude design it based on your profile, history, and training science.</p>

      {/* Template picker */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-3">Workout Type</label>
        <div className="grid grid-cols-4 gap-3">
          {CYCLE_ORDER.map((t) => {
            const isSelected = t === template;
            const isSuggested = t === suggestedTemplate;
            const color = TEMPLATE_COLORS[t];
            return (
              <button
                key={t}
                onClick={() => selectTemplate(t)}
                className={`relative border-2 p-4 text-left transition-all ${
                  isSelected
                    ? "border-[var(--color-accent)] bg-[var(--color-surface)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-text-faint)]"
                }`}
              >
                {isSuggested && (
                  <span className="absolute top-2 right-2 text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider">
                    Next
                  </span>
                )}
                <span className={`inline-block text-xs font-bold px-2 py-0.5 mb-2 ${color}`}>
                  {TEMPLATES[t].label}
                </span>
                <p className="text-xs text-[var(--color-text-faint)] leading-snug">
                  {TEMPLATES[t].slots.map((s) => s.label).join(" · ")}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div>
          <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Session date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="flex-1" />
        <button
          onClick={generate}
          disabled={generating || !template}
          className="btn-accent"
        >
          {generating ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {plan ? "Regenerate" : "Generate with AI"}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-[#1a0505] border border-[#3a1010] text-[#f87171] text-sm p-4">{error}</div>
      )}

      {plan && (
        <div className="mb-6 bg-[#110a1a] border border-[#2a1a3a] p-4">
          <p className="text-xs font-bold text-[#c4b5fd] mb-1 uppercase tracking-widest">Coach Notes</p>
          <p className="text-sm text-[#c4b5fd]">{plan.sessionNotes}</p>
        </div>
      )}

      {exercises.length > 0 && (
        <>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest">Exercise</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest">Muscles</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest w-16">Sets</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest w-20">Reps</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest w-24">Start Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {exercises.map((ex, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <input
                        value={ex.name}
                        onChange={(e) => updateExercise(i, "name", e.target.value)}
                        className="w-full font-medium text-[var(--color-text)] bg-transparent border-b border-transparent focus:border-[var(--color-accent)] focus:outline-none"
                      />
                      {ex.aiNotes && (
                        <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{ex.aiNotes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-faint)] text-xs">{ex.muscleGroups}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={ex.targetSets}
                        onChange={(e) => updateExercise(i, "targetSets", Number(e.target.value))}
                        className="w-12 text-center bg-[var(--color-bg)] border border-[var(--color-border)] px-1 py-0.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={ex.targetReps}
                        onChange={(e) => updateExercise(i, "targetReps", e.target.value)}
                        className="w-16 text-center bg-[var(--color-bg)] border border-[var(--color-border)] px-1 py-0.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={ex.targetWeight ?? ""}
                          onChange={(e) => updateExercise(i, "targetWeight", e.target.value ? Number(e.target.value) : null)}
                          placeholder="BW"
                          className="w-16 text-center bg-[var(--color-bg)] border border-[var(--color-border)] px-1 py-0.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        <span className="text-xs text-[var(--color-text-faint)]">lbs</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest border border-[var(--color-border)] text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Revise with AI
            </button>
            <button
              onClick={saveSession}
              disabled={saving}
              className="btn-accent"
            >
              {saving ? "Saving..." : "Save Plan & Go to Gym →"}
            </button>
          </div>
        </>
      )}

      {!plan && !generating && !error && (
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] p-16 text-center text-[var(--color-text-faint)]">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-sm">Select a workout type and hit &ldquo;Generate with AI&rdquo;.</p>
          <p className="text-xs mt-1 opacity-70">Claude will design it based on your profile, equipment, and training history.</p>
        </div>
      )}

      {template && (
        <PlanReviseDrawer
          open={drawerOpen}
          template={template}
          currentExercises={exercises}
          initialPlanJson={initialPlanJson}
          onApply={(updated, msgs) => {
            setExercises(updated);
            setPlanningMessages(msgs);
            // drawer stays open so the user can keep refining
          }}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `app/api/sessions/route.ts` to accept `planningChat`**

Replace the POST handler body:

```typescript
export async function POST(req: Request) {
  const body = await req.json();
  const { date, template, notes, exercises, planningChat } = body;

  const session = await db.workoutSession.create({
    data: {
      date,
      template,
      notes: notes || null,
      planningChat: planningChat || null,
      phase: "planned",
      exercises: {
        create: exercises.map(
          (ex: {
            slot: string;
            name: string;
            muscleGroups: string;
            targetSets: number;
            targetReps: string;
            targetWeight: number | null;
            orderIndex: number;
            aiNotes: string | null;
          }) => ({
            slot: ex.slot,
            name: ex.name,
            muscleGroups: ex.muscleGroups,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps,
            targetWeight: ex.targetWeight ?? null,
            orderIndex: ex.orderIndex,
            aiNotes: ex.aiNotes ?? null,
          })
        ),
      },
    },
    include: { exercises: { include: { sets: true } } },
  });

  return NextResponse.json(session);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "implicitly has an 'any'"
```

Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

Start the dev server if not already running:
```bash
npm run dev
```

Open `http://localhost:3000/sessions/plan` in a browser and verify:

1. Generate a workout — "Revise with AI" button appears next to "Save Plan & Go to Gym"
2. Click "Revise with AI" — drawer slides in from the right, backdrop dims the page
3. Type a feedback message (e.g. "swap the first exercise for something with dumbbells") and press Enter — spinner appears, then Claude's reply + diff table render
4. Changed exercise rows show amber left border; changed fields (name, weight, etc.) appear in amber bold; unchanged rows are dimmed
5. Click "Accept All Changes" — drawer closes, exercise table updates with proposed exercises
6. Reopen drawer — conversation history is preserved
7. Click "Save Plan & Go to Gym" — redirects to the record page as normal

- [ ] **Step 5: Commit**

```bash
git add app/sessions/plan/page.tsx app/api/sessions/route.ts
git commit -m "feat: wire plan revision drawer and persist planningChat on session save"
```
