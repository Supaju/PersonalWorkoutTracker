# Strength Progress Visualization — Design Spec

## Goal

Add a `/progress` page that shows week-over-week strength gains per exercise, organized by muscle group, with a recent PRs highlight strip.

## Architecture

- **New page:** `app/progress/page.tsx` — client component
- **New API route:** `app/api/progress/route.ts` — queries DB, returns structured JSON
- **Sidebar nav:** Add "Progress" link to `app/layout.tsx`
- **New dependency:** `recharts` (React charting library, dark-theme-friendly)
- **No schema changes** — reads existing `WorkoutSession`, `SessionExercise`, `SetLog`

## Data Model

### API: `GET /api/progress`

Queries all `WorkoutSession` records where `phase = "recorded"`, includes `exercises → sets`.

For each `SessionExercise`, per session:
- **Max weight** = `Math.max(...sets.map(s => s.weightLbs))` — primary strength metric
- **Volume** = `sum(weightLbs × reps)` across all sets — secondary, shown on hover

Exercise name matching is case-insensitive exact string match. "Squat" and "Back Squat" are treated as separate exercises — consistent since exercises come from templates.

### Response shape

```ts
{
  exercises: {
    name: string;
    muscleGroup: "legs" | "chest" | "back" | "shoulders" | "arms" | "other";
    data: {
      date: string;       // WorkoutSession.date
      maxWeight: number;
      volume: number;
      sets: number;       // total sets recorded in this session
      reps: number;       // reps from the max-weight set
    }[];
  }[];
  recentPRs: {
    name: string;
    weight: number;       // all-time max weight
    delta: number;        // lbs gained vs. previous session (0 if only one session)
  }[];                    // up to 4 exercises whose most recent session is also their all-time PR
}
```

### Muscle group keyword map

Match against `SessionExercise.muscleGroups` (lowercase). First match wins.

| Tab | Keywords |
|-----|----------|
| legs | quad, glute, hamstring, calf, hip |
| chest | chest, pec |
| back | lat, rhomboid, trap, row |
| shoulders | delt, shoulder |
| arms | bicep, tricep, forearm, curl |
| other | (fallback — no keyword matched) |

"Other" tab is only shown if at least one exercise falls into it.

## Page Layout

### State

- `activeTab: string` — selected muscle group tab (default: first tab with exercises)
- `selectedExercise: string | null` — null = grid view, string = drill-down view

### Grid view (selectedExercise = null)

1. **Recent PRs strip** — Up to 4 cards showing exercises that hit an all-time PR in their most recent recorded session. Shows however many qualify (1–4); hidden entirely if none qualify. Each card: exercise name, PR weight in lbs, delta vs. previous session (green ↑ with "+N lbs" or neutral → with "no change").
2. **Tab bar** — Legs / Chest / Back / Shoulders / Arms / Other (only tabs with exercises shown)
3. **Sparkline grid** — 2-column grid of exercise cards. Each card:
   - Exercise name + current max weight (top row)
   - Inline SVG sparkline (simple, no Recharts needed)
   - % change over all recorded sessions + trend indicator (green ↑ / gray → / red ↓)
   - Clicking a card sets `selectedExercise`

### Drill-down view (selectedExercise = exercise name)

1. **Back link** — "← Back to [Tab]" resets `selectedExercise` to null
2. **Exercise header** — name, all-time PR, starting weight, % total change
3. **Full Recharts `LineChart`** — area fill, dot per session, X-axis = session date, Y-axis = max weight. Tooltip shows date + max weight + volume on hover.
4. **Session history table** — one row per session, newest first: date, max weight, delta vs. previous session ("+10 lbs" / "—"), sets × reps of the max-weight set (e.g. "5 reps @ 245 lbs, 4 sets")

### Empty / edge states

- **No recorded sessions** — progress page shows a centered empty state: "Record some sessions to see your strength progress."
- **Exercise with one data point** — shown in grid, drill-down renders single dot with note: "Only one session recorded — come back after your next workout."
- **No recent PRs** — PR strip is hidden (not shown as empty cards)

## Navigation

Add "Progress" link to sidebar in `app/layout.tsx`, between Dashboard and Sessions (or after Sessions — wherever it fits the flow). Use the same nav link style as existing items.

## Dependencies

```bash
npm install recharts
```

Recharts ships with TypeScript types. No additional `@types` package needed.
