# Personal Workout Tracker

A personal fitness app built with Next.js and Claude AI. Plans workouts based on training history, tracks sessions and sets, and lets you have a conversation with Claude to refine the plan before you hit the gym.

## Features

- **AI workout planning** — Claude designs each session based on your profile, equipment, and prior session history using progressive overload
- **4-day Upper/Lower split** — Upper A, Lower A, Upper B, Lower B cycling automatically
- **Conversational plan revision** — after generating a workout, give Claude feedback in a chat drawer and see a diff of proposed changes before accepting
- **Session recording** — log sets, reps, and weight for each exercise during your workout
- **Progress tracking** — charts for volume, weight, and reps over time per exercise
- **Meal planning** — AI-generated daily meal plans from your food library with macro targets
- **Equipment management** — catalog your gym's equipment so Claude picks appropriate exercises
- **Nutrition deviation analysis** — describe what you ate and get a macro estimate and course correction

## Tech Stack

- [Next.js 15](https://nextjs.org/) App Router
- [Prisma](https://www.prisma.io/) + SQLite
- [Anthropic Claude API](https://www.anthropic.com/) (`claude-sonnet-4-6`)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/)

## Getting Started

### Prerequisites

- Node.js 18+
- An Anthropic API key

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local

# Run database migrations
npx prisma migrate deploy

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### First-time configuration

1. **Profile** — set your age, weight, height, and gender so Claude can calculate targets
2. **Equipment** — add the machines and free weights available at your gym
3. **Food library** — add foods you regularly eat for meal planning

## Project Structure

```
app/                  # Next.js App Router pages and API routes
  api/                # API routes (sessions, equipment, meals, AI endpoints)
  sessions/           # Plan, record, and review session pages
  progress/           # Progress charts
  meals/              # Meal planning
  equipment/          # Equipment management
  profile/            # User profile
components/           # Shared React components
lib/
  ai.ts               # Claude prompt builders
  ai-config.ts        # Central config for all AI goals and guidelines
  templates.ts        # Workout template structure (slots, examples, set counts)
  types.ts            # Shared TypeScript types
prisma/
  schema.prisma       # Database schema
```

## AI Configuration

All training philosophy, nutrition targets, and AI behavior lives in `lib/ai-config.ts`. Edit this file to change goals, rep ranges, progression rules, or nutrition targets without touching prompt strings.

Workout program structure (the A/B split, slot definitions, and exercise options) lives in `lib/templates.ts`.
