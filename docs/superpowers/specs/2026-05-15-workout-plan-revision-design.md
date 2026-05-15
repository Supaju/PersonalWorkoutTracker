# Workout Plan Revision — Design Spec

**Date:** 2026-05-15

## Goal

Allow the user to give conversational feedback on a generated workout plan, let Claude revise it, see a diff of proposed changes, and accept or reject them — all before saving the session. The conversation is persisted on the `WorkoutSession` record so it can be reviewed later.

## Scope

Plan page only (`app/sessions/plan/page.tsx`). Other AI pages (meals, review) are out of scope for this spec.

---

## Architecture

### New files
- `app/api/sessions/plan/refine/route.ts` — POST endpoint for revision requests
- `components/PlanReviseDrawer.tsx` — slide-in drawer component with chat thread + diff view

### Modified files
- `prisma/schema.prisma` — add `planningChat String?` to `WorkoutSession`
- `lib/ai.ts` — add `buildRefinePrompt()`
- `lib/ai-config.ts` — add `refine` section for tone/format guidance
- `app/sessions/plan/page.tsx` — wire up drawer, diff state, and planningChat on save
- `app/api/sessions/route.ts` — accept and persist `planningChat` on session creation

---

## Data Flow

1. User generates a workout via existing `POST /api/sessions/plan` — no change to this flow.
2. "Revise with AI" button appears alongside the exercise table. Clicking it opens the drawer.
3. User types feedback → drawer POSTs to `POST /api/sessions/plan/refine` with:
   - `template` — current workout type
   - `currentExercises` — the exercise list as it stands right now
   - `messages` — full conversation history so far (user + assistant turns)
   - `userMessage` — the new feedback text
4. Refine endpoint returns `{ reply: string, proposedExercises: PlannedExercise[] }`.
5. Drawer renders the chat reply + diff view. User accepts or rejects.
6. On "Accept All Changes": `proposedExercises` replaces `exercises` in the plan page. Diff clears. Drawer stays open.
7. On "Save Plan & Go to Gym": serialized `messages[]` is included in the POST to `POST /api/sessions` as `planningChat`.

---

## API: `POST /api/sessions/plan/refine`

### Shared type
```typescript
type Message = { role: "user" | "assistant"; content: string };
```
Defined in `lib/types.ts` and shared between the drawer component and the API route.

### Request body
```typescript
{
  template: TemplateId;
  currentExercises: PlannedExercise[];
  initialPlanJson: string;   // stringified original Claude plan response, for multi-turn replay
  messages: Message[];
  userMessage: string;
}
```

### Response
```typescript
{
  reply: string;           // plain-English explanation of what changed and why
  exercises: PlannedExercise[];  // full updated exercise list (not a partial diff)
}
```

### Server behaviour
- Re-fetches profile, equipment, and session history on every call (stateless, same as plan endpoint).
- Builds a multi-turn Claude message array:
  - Turn 1 (user): original plan prompt (freshly rebuilt via `buildPlanPrompt` using re-fetched profile/equipment/history)
  - Turn 2 (assistant): `initialPlanJson` from the request body (the original Claude response verbatim)
  - Turns 3–N: prior conversation history from `messages`
  - Final turn (user): new feedback message + current exercise list as JSON context
- Calls Claude with `buildRefinePrompt()` system prompt.
- Returns parsed `{ reply, exercises }`.

---

## Prompt Design

### `buildRefinePrompt()` in `lib/ai.ts`
Returns a system prompt string (not a user/system pair — the multi-turn history carries the context).

Content (driven by `AI_CONFIG.refine`):
- Trainer persona (shared with other prompts via `AI_CONFIG.persona`)
- Instruction to return JSON: `{ "reply": "...", "exercises": [...] }`
- `reply` must be plain English explaining specifically what was changed and why
- `exercises` must be the full exercise list, not partial — unchanged exercises are returned as-is
- Maintain all existing fields on unchanged exercises (slot, muscleGroups, aiNotes, etc.)

### `AI_CONFIG.refine` section
```typescript
refine: {
  instruction: `You are revising a workout plan based on user feedback. Return ONLY valid JSON: { "reply": "...", "exercises": [...] }. In "reply", explain exactly what you changed and why in 2-4 sentences. In "exercises", return the complete updated list — include unchanged exercises as-is.`,
}
```

---

## UI: `PlanReviseDrawer` Component

### Props
```typescript
{
  open: boolean;
  template: TemplateId;
  currentExercises: PlannedExercise[];
  initialPlanJson: string;        // stringified original AI plan for context replay
  onApply: (exercises: PlannedExercise[], messages: Message[]) => void;
  onClose: () => void;
}
```

### Internal state
```typescript
messages: Message[]                            // full conversation history
proposedExercises: PlannedExercise[] | null    // pending diff (null = no pending proposal)
sending: boolean
inputText: string
error: string
```

### Layout (top to bottom, fixed right panel, ~480px wide, full viewport height)
1. **Header**: "Revise with AI" + X close button
2. **Chat thread** (scrollable, flex-grow): alternating user (right-aligned, accent border) and assistant (left-aligned, surface background) messages. Assistant message text appears above the diff if a proposal is present.
3. **Diff table** (shown when `proposedExercises !== null`):
   - All exercises listed; unchanged rows dimmed at 50% opacity
   - Changed rows: amber-left border (`border-l-2 border-amber-500`)
   - Changed fields within a row: bold, amber text
   - Fields compared: `name`, `targetSets`, `targetReps`, `targetWeight`
   - Two buttons: **"Accept All Changes"** and **"Keep Current"**
4. **Input area** (fixed at bottom): textarea + Send button. Disabled while `sending`.

### Behaviour
- "Accept All Changes": calls `onApply(proposedExercises, messages)`, clears `proposedExercises`, drawer stays open.
- "Keep Current": clears `proposedExercises` only, conversation continues.
- X / close: calls `onClose()`. Conversation is not lost — reopening the drawer restores it (state lives in plan page).

---

## Diff Computation

Computed in the drawer component by comparing `currentExercises` and `proposedExercises` by array index:

```typescript
function isChanged(current: PlannedExercise, proposed: PlannedExercise): boolean {
  return (
    current.name !== proposed.name ||
    current.targetSets !== proposed.targetSets ||
    current.targetReps !== proposed.targetReps ||
    current.targetWeight !== proposed.targetWeight
  );
}

function changedFields(current: PlannedExercise, proposed: PlannedExercise): Set<string> {
  const fields = new Set<string>();
  if (current.name !== proposed.name) fields.add("name");
  if (current.targetSets !== proposed.targetSets) fields.add("targetSets");
  if (current.targetReps !== proposed.targetReps) fields.add("targetReps");
  if (current.targetWeight !== proposed.targetWeight) fields.add("targetWeight");
  return fields;
}
```

---

## Schema Change

`prisma/schema.prisma` — add to `WorkoutSession`:
```prisma
planningChat String?   // JSON-serialized Message[] array, null if no revision chat occurred
```

Migration: `npx prisma migrate dev --name add_planning_chat`

Safe: field is nullable, existing sessions get `null` automatically.

---

## Plan Page Changes (`app/sessions/plan/page.tsx`)

New state:
```typescript
const [drawerOpen, setDrawerOpen] = useState(false);
const [planningMessages, setPlanningMessages] = useState<Message[]>([]);
const [initialPlanJson, setInitialPlanJson] = useState("");
```

- After plan generation: capture `JSON.stringify(plan)` into `initialPlanJson`.
- "Revise with AI" button: rendered next to "Save Plan" once `plan !== null`.
- `onApply` handler: `setExercises(updated); setPlanningMessages(msgs);`
- On `saveSession`: include `planningChat: JSON.stringify(planningMessages)` if `planningMessages.length > 0`, otherwise omit.

---

## Session Create API Change (`app/api/sessions/route.ts`)

Accept optional `planningChat` string in request body and pass it to `db.workoutSession.create`. No validation needed — it's an opaque string from trusted client code.

---

## Error Handling

- Refine endpoint: try/catch returning `{ error: string }` with status 500. Drawer shows inline error message below the input.
- Network failure on send: same inline error, input re-enabled so user can retry.
- Claude returns malformed JSON: return `{ error: "AI returned invalid response" }` — same error path.

---

## Out of Scope

- Surfacing `planningChat` in the session detail view (future)
- Extending conversational revision to meal planning or AI review pages (future)
- Per-exercise accept/reject (accept all or keep current only)
- Streaming responses
