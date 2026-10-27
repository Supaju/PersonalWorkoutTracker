# Personal Workout Tracker

An AI personal trainer built with Next.js and Claude. You talk to the coach. It plans each session from your history, schedule, recovery and how you feel today. You log the session set by set on your phone, and the coach reviews it, asks about anything ambiguous, and sets the next targets. Over weeks it reviews the program itself and proposes changes, backed by research.

## The core loop

1. **Check in.** How you feel, what's sore, how much time you have.
2. **Plan.** The coach writes today's session (warm-up → strength with supersets → conditioning → cool-down) to fit your time, and explains why it looks that way.
3. **Adjust.** Push back or ask ("I'd rather bench"). The coach changes the plan and remembers preferences.
4. **Log.** Live mode on your phone: steppers, RIR buttons, rest timer, skip reasons, cardio, abandoned attempts. Works offline.
5. **Review.** The coach reads the log, asks targeted questions (for example "How many reps did you have left?"), and sets next targets.
6. **Evolve.** Program reviews (every 4 weeks, or when triggered) produce proposals you accept or reject. Accepting one creates a new program version.

## Features

- **Coach conversation** (home page): persistent per client. It can plan, refine, save preferences and considerations, update your schedule, review sessions, answer questions, start program reviews and run research.
- **Today's workout and live recording** (`/sessions/today`): blocks, A1/A2 pairs, ramp vs working sets, targets with RIR, cues, and per-exercise history. Sets save as you go, with an offline queue and retry.
- **History** shows planned vs actual. **Progress** charts working weight, estimated strength (reps + RIR), bodyweight, adherence, cardio and program-version markers. Each session has a **printable** paper log sheet.
- **Program** (`/program`): current version, this week, version history, proposals, and research notes with sources.
- **Settings** (`/settings`): profile, schedule, coach persona, considerations, exercise preferences, equipment, and adding a client.
- **Meals and nutrition**: AI meal plans and a conversational food log, scoped per client.
- **Multiple clients**: switch clients in the header. All data is isolated per client. There is no authentication yet.

## Tech stack

Next.js 16 (App Router) · Prisma + SQLite · Anthropic SDK (Claude Sonnet 5.5 for routine coaching, Claude Opus 5.5 for program reviews and research, with server-side web search) · Tailwind CSS v4 · Recharts · zod · vitest

## Getting started

```bash
npm install
cp .env.example .env.local      # add ANTHROPIC_API_KEY (and USDA/Tavily keys for nutrition)
npx prisma migrate deploy
npm run seed:owner              # optional: the owner's October 2026 history + program v1 (idempotent)
npm run dev
```

Open http://localhost:3000.

| Command | What it does |
|---|---|
| `npm test` | Unit and DB tests (vitest, on `prisma/test.db`; never touches `dev.db`) |
| `npm run eval` | Model-in-the-loop acceptance eval against the section 7 fixture (`prisma/eval.db`, makes live API calls) |
| `npm run typecheck` | `tsc --noEmit` |

## Where the coaching philosophy lives

| What | Where |
|---|---|
| Rules as numbers (progression %, RIR targets, rounding, readiness swaps, program-review thresholds) and the model choice | `lib/coach/philosophy.ts` |
| Rules as prose injected into prompts (session design, weekly structure, safety, voice, research) | `PHILOSOPHY` in `lib/coach/philosophy.ts` |
| Deterministic decisions (session type, layoff, next working weight, duration, week view) | `lib/coach/rules.ts` (unit-tested) |
| Program triggers, proposals, versioning | `lib/coach/program-review.ts` |
| Program structures (heavy/light full body, Upper/Lower 4-day) | `lib/coach/structures.ts` |
| Per-client settings: schedule, session minutes, layoff threshold, review cadence, web research on/off, persona | the `Client` row, edited in Settings |
| Per-client considerations (body size, injuries) and exercise preferences | Settings, or tell the coach |

Anything that can be computed is computed in code and passed to the model as a fact. The model writes the plan around those facts, and the code checks its output (weights, disliked exercises, time budget) before saving it.

## Adding a client

Go to Settings → **New client** (or `POST /api/clients`), then pick the client in the header switcher. Set their schedule, considerations and persona in Settings, and talk to the coach to plan their first session. The first session is a re-entry session, since there's no history yet. Every query is scoped through `getClientId()` in `lib/client.ts`, the one place that decides the current client.

## Design docs

`docs/coach-v2/PLAN.html`: architecture, data model, API contract, workstreams, and open questions.
