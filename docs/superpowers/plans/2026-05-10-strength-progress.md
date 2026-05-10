# Strength Progress Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/progress` page showing max-weight-per-exercise over time, organized by muscle group tabs, with a recent PRs strip and click-to-expand full chart view.

**Architecture:** A single client page (`app/progress/page.tsx`) fetches from a new `GET /api/progress` route that queries all recorded sessions, groups exercises by name, computes max weight and volume per session, and returns structured JSON including recent PRs. The grid view uses inline SVG sparklines; the drill-down uses Recharts AreaChart.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Prisma (SQLite), Recharts, Tailwind CSS v4 with `var(--color-*)` tokens.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/api/progress/route.ts` | Create | Query DB, compute metrics, return JSON |
| `app/progress/page.tsx` | Create | Full client page: PR strip, tabs, sparklines, drill-down |
| `components/sidebar.tsx` | Modify | Add Progress nav link |

---

## Task 1: Install recharts

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Verify it appears in package.json**

```bash
grep recharts package.json
```

Expected output: `"recharts": "^2.x.x"` under `"dependencies"`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install recharts for strength progress charts"
```

---

## Task 2: Add Progress nav link to sidebar

**Files:**
- Modify: `components/sidebar.tsx`

The sidebar is a client component that renders `navItems` as `Link` elements. Add a new entry for `/progress` between Sessions and Meals.

- [ ] **Step 1: Open `components/sidebar.tsx` and locate the `navItems` array** (lines 6–61). Add the Progress entry after the Sessions entry (after the closing `}` of the Sessions item, before the Meals item):

```typescript
  {
    href: "/progress",
    label: "Progress",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
```

- [ ] **Step 2: Verify the full `navItems` array now looks like this** (order: Dashboard, Profile, Equipment, Sessions, Progress, Meals, AI Review):

```typescript
const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    href: "/equipment",
    label: "Equipment",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    href: "/sessions",
    label: "Sessions",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: "/progress",
    label: "Progress",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    href: "/meals",
    label: "Meals",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: "/ai-review",
    label: "AI Review",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];
```

- [ ] **Step 3: Commit**

```bash
git add components/sidebar.tsx
git commit -m "feat: add Progress link to sidebar"
```

---

## Task 3: API route — `app/api/progress/route.ts`

**Files:**
- Create: `app/api/progress/route.ts`

This route:
1. Fetches all recorded sessions with exercises and sets, ordered by date ascending
2. Groups exercises by lowercase name across sessions
3. Computes per-session: max weight (heaviest set), volume (sum of weight×reps), sets count, reps of the max-weight set
4. Identifies muscle group from `SessionExercise.muscleGroups` via keyword map
5. Finds recent PRs: exercises whose latest session matches their all-time max weight

- [ ] **Step 1: Create `app/api/progress/route.ts` with this exact content:**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const MUSCLE_GROUP_KEYWORDS: Record<string, string[]> = {
  legs: ["quad", "glute", "hamstring", "calf", "hip"],
  chest: ["chest", "pec"],
  back: ["lat", "rhomboid", "trap", "row"],
  shoulders: ["delt", "shoulder"],
  arms: ["bicep", "tricep", "forearm", "curl"],
};

function getMuscleGroup(muscleGroups: string): string {
  const lower = muscleGroups.toLowerCase();
  for (const [group, keywords] of Object.entries(MUSCLE_GROUP_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return group;
  }
  return "other";
}

export async function GET() {
  const sessions = await db.workoutSession.findMany({
    where: { phase: "recorded" },
    include: {
      exercises: {
        include: { sets: true },
      },
    },
    orderBy: { date: "asc" },
  });

  const exerciseMap = new Map<
    string,
    {
      name: string;
      muscleGroup: string;
      data: { date: string; maxWeight: number; volume: number; sets: number; reps: number }[];
    }
  >();

  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (ex.sets.length === 0) continue;

      const key = ex.name.toLowerCase();
      if (!exerciseMap.has(key)) {
        exerciseMap.set(key, {
          name: ex.name,
          muscleGroup: getMuscleGroup(ex.muscleGroups),
          data: [],
        });
      }

      const maxSet = ex.sets.reduce(
        (best, s) => (s.weightLbs > best.weightLbs ? s : best),
        ex.sets[0]
      );
      const volume = ex.sets.reduce((sum, s) => sum + s.weightLbs * s.reps, 0);

      exerciseMap.get(key)!.data.push({
        date: session.date,
        maxWeight: maxSet.weightLbs,
        volume,
        sets: ex.sets.length,
        reps: maxSet.reps,
      });
    }
  }

  const exercises = Array.from(exerciseMap.values());

  const recentPRs = exercises
    .filter((ex) => ex.data.length > 0)
    .flatMap((ex) => {
      const latest = ex.data[ex.data.length - 1];
      const allTimeMax = Math.max(...ex.data.map((d) => d.maxWeight));
      if (latest.maxWeight < allTimeMax) return [];
      const prev = ex.data[ex.data.length - 2];
      return [
        {
          name: ex.name,
          weight: latest.maxWeight,
          delta: prev ? latest.maxWeight - prev.maxWeight : 0,
        },
      ];
    })
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4);

  return NextResponse.json({ exercises, recentPRs });
}
```

- [ ] **Step 2: Verify the route works by starting the dev server and hitting the endpoint**

```bash
npm run dev
```

Then in another terminal:
```bash
curl http://localhost:3000/api/progress
```

Expected: JSON with `{ "exercises": [...], "recentPRs": [...] }`. If no recorded sessions exist yet, both arrays will be empty: `{ "exercises": [], "recentPRs": [] }`.

- [ ] **Step 3: Stop the dev server and commit**

```bash
git add app/api/progress/route.ts
git commit -m "feat: add GET /api/progress API route"
```

---

## Task 4: Progress page — `app/progress/page.tsx`

**Files:**
- Create: `app/progress/page.tsx`

This is a single client component file. It handles both the grid view (PR strip + tabs + sparkline cards) and the drill-down view (full AreaChart + session history table). The `selectedExercise` state string switches between the two views.

- [ ] **Step 1: Create `app/progress/page.tsx` with this exact content:**

```typescript
"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type DataPoint = {
  date: string;
  maxWeight: number;
  volume: number;
  sets: number;
  reps: number;
};

type ExerciseProgress = {
  name: string;
  muscleGroup: string;
  data: DataPoint[];
};

type RecentPR = {
  name: string;
  weight: number;
  delta: number;
};

type ProgressData = {
  exercises: ExerciseProgress[];
  recentPRs: RecentPR[];
};

const TAB_ORDER = ["legs", "chest", "back", "shoulders", "arms", "other"];
const TAB_LABELS: Record<string, string> = {
  legs: "Legs",
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  other: "Other",
};

function Sparkline({ data }: { data: DataPoint[] }) {
  if (data.length === 0) return null;
  const W = 200;
  const H = 40;
  const weights = data.map((d) => d.maxWeight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const pts = weights.map((w, i) => ({
    x: weights.length === 1 ? W / 2 : (i / (weights.length - 1)) * W,
    y: H - ((w - min) / range) * (H - 6) - 3,
  }));

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8" preserveAspectRatio="none">
      {data.length > 1 && (
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
        />
      )}
      <circle cx={last.x} cy={last.y} r="3" fill="var(--color-accent)" />
    </svg>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DataPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-xs">
      <p className="text-[var(--color-text-faint)] mb-1">{d.date}</p>
      <p className="text-[var(--color-text)] font-bold">{d.maxWeight} lbs</p>
      <p className="text-[var(--color-text-faint)]">
        Vol: {Math.round(d.volume).toLocaleString()} lbs
      </p>
      <p className="text-[var(--color-text-faint)]">
        {d.reps} reps × {d.sets} sets
      </p>
    </div>
  );
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("legs");
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => r.json())
      .then((d: ProgressData) => {
        setData(d);
        const firstTab = TAB_ORDER.find((t) =>
          d.exercises.some((e) => e.muscleGroup === t)
        );
        if (firstTab) setActiveTab(firstTab);
      });
  }, []);

  if (!data) {
    return (
      <div className="text-[var(--color-text-faint)] text-sm">Loading...</div>
    );
  }

  if (data.exercises.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">
          Strength Progress
        </h2>
        <p className="text-[var(--color-text-faint)] text-sm mb-8">
          Max weight lifted per exercise over time.
        </p>
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-faint)]">
          <p className="text-sm">
            Record some sessions to see your strength progress.
          </p>
          <p className="text-xs mt-1 opacity-70">
            Only recorded sessions count — planned sessions are excluded.
          </p>
        </div>
      </div>
    );
  }

  const availableTabs = TAB_ORDER.filter((t) =>
    data.exercises.some((e) => e.muscleGroup === t)
  );
  const tabExercises = data.exercises.filter((e) => e.muscleGroup === activeTab);
  const exerciseDetail = selectedExercise
    ? data.exercises.find((e) => e.name === selectedExercise) ?? null
    : null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">
        Strength Progress
      </h2>
      <p className="text-[var(--color-text-faint)] text-sm mb-8">
        Max weight lifted per exercise over time.
      </p>

      {/* Recent PRs strip */}
      {data.recentPRs.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-3">
            Recent PRs
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.recentPRs.map((pr) => (
              <button
                key={pr.name}
                onClick={() => {
                  const tab =
                    data.exercises.find((e) => e.name === pr.name)
                      ?.muscleGroup ?? activeTab;
                  setActiveTab(tab);
                  setSelectedExercise(pr.name);
                }}
                className="bg-[#0a1a0a] border border-[#1a3a1a] p-4 text-left hover:border-[#86efac] transition-colors"
              >
                <p className="text-xs text-[#86efac] uppercase tracking-wider truncate">
                  {pr.name}
                </p>
                <p className="text-xl font-bold text-[var(--color-text)] mt-1">
                  {pr.weight}
                  <span className="text-xs font-normal text-[var(--color-text-faint)]">
                    {" "}
                    lbs
                  </span>
                </p>
                <p className="text-xs mt-1">
                  {pr.delta > 0 ? (
                    <span className="text-[#86efac]">↑ +{pr.delta} lbs</span>
                  ) : (
                    <span className="text-[var(--color-text-faint)]">
                      → first entry
                    </span>
                  )}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drill-down view */}
      {exerciseDetail ? (
        <div>
          <button
            onClick={() => setSelectedExercise(null)}
            className="text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)] mb-6"
          >
            ← Back to {TAB_LABELS[activeTab] ?? activeTab}
          </button>

          <div className="mb-6">
            <h3 className="text-xl font-bold text-[var(--color-text)] uppercase tracking-wide">
              {exerciseDetail.name}
            </h3>
            <div className="flex flex-wrap gap-6 mt-2 text-sm">
              <span className="text-[#86efac]">
                PR:{" "}
                {Math.max(...exerciseDetail.data.map((d) => d.maxWeight))} lbs
              </span>
              <span className="text-[var(--color-text-faint)]">
                Started: {exerciseDetail.data[0].maxWeight} lbs
              </span>
              {exerciseDetail.data.length > 1 && (
                <span className="text-[var(--color-accent)]">
                  {(
                    ((exerciseDetail.data[exerciseDetail.data.length - 1]
                      .maxWeight -
                      exerciseDetail.data[0].maxWeight) /
                      exerciseDetail.data[0].maxWeight) *
                    100
                  ).toFixed(0)}
                  % over {exerciseDetail.data.length} sessions
                </span>
              )}
            </div>
          </div>

          {exerciseDetail.data.length === 1 ? (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center text-[var(--color-text-faint)] text-sm mb-6">
              Only one session recorded — come back after your next workout.
            </div>
          ) : (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 mb-6">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={exerciseDetail.data}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="weightGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#dc2626"
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor="#dc2626"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#555", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#555", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="maxWeight"
                    stroke="#dc2626"
                    strokeWidth={2}
                    fill="url(#weightGrad)"
                    dot={{ fill: "#dc2626", r: 3 }}
                    activeDot={{ r: 5, fill: "#dc2626" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <h3 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-3">
            Session History
          </h3>
          <div className="space-y-1">
            {[...exerciseDetail.data].reverse().map((d, i, arr) => {
              const prev = arr[i + 1];
              const delta = prev ? d.maxWeight - prev.maxWeight : null;
              return (
                <div
                  key={d.date}
                  className="flex items-center gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3 text-sm"
                >
                  <span className="text-[var(--color-text-faint)] w-24 shrink-0">
                    {d.date}
                  </span>
                  <span className="font-bold text-[var(--color-text)] w-20">
                    {d.maxWeight} lbs
                  </span>
                  <span className="text-xs w-24">
                    {delta === null ? (
                      <span className="text-[var(--color-text-faint)]">—</span>
                    ) : delta > 0 ? (
                      <span className="text-[#86efac]">+{delta} lbs</span>
                    ) : delta < 0 ? (
                      <span className="text-[#f87171]">{delta} lbs</span>
                    ) : (
                      <span className="text-[var(--color-text-faint)]">
                        no change
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-[var(--color-text-faint)]">
                    {d.reps} reps × {d.sets} sets
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Grid view */
        <div>
          {/* Tab bar */}
          <div className="flex border-b border-[var(--color-border)] mb-6">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
                }`}
              >
                {TAB_LABELS[tab] ?? tab}
              </button>
            ))}
          </div>

          {/* Sparkline grid */}
          <div className="grid grid-cols-2 gap-4">
            {tabExercises.map((ex) => {
              const latest = ex.data[ex.data.length - 1];
              const pct =
                ex.data.length > 1
                  ? ((latest.maxWeight - ex.data[0].maxWeight) /
                      ex.data[0].maxWeight) *
                    100
                  : null;
              return (
                <button
                  key={ex.name}
                  onClick={() => setSelectedExercise(ex.name)}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 text-left hover:border-[var(--color-text-faint)] transition-colors"
                >
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-bold text-[var(--color-text)] truncate mr-2">
                      {ex.name}
                    </span>
                    <span className="text-sm text-[var(--color-accent)] shrink-0">
                      {latest.maxWeight} lbs
                    </span>
                  </div>
                  <Sparkline data={ex.data} />
                  <div className="mt-2 text-xs">
                    {pct === null ? (
                      <span className="text-[var(--color-text-faint)]">
                        1 session
                      </span>
                    ) : pct > 0 ? (
                      <span className="text-[#86efac]">
                        ↑ +{pct.toFixed(0)}% over {ex.data.length} sessions
                      </span>
                    ) : pct < 0 ? (
                      <span className="text-[#f87171]">
                        ↓ {pct.toFixed(0)}% over {ex.data.length} sessions
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-faint)]">
                        → no change over {ex.data.length} sessions
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Start the dev server and navigate to http://localhost:3000/progress**

```bash
npm run dev
```

Verify:
- If no recorded sessions: "Record some sessions to see your strength progress." empty state renders correctly.
- If recorded sessions exist: PR strip shows at top, muscle group tabs appear, sparkline cards show for the active tab, clicking a card shows the drill-down with AreaChart and session history.
- PR strip cards click through to the correct exercise drill-down.
- "← Back to [Tab]" link returns to the grid view.
- Sidebar shows "Progress" link with active state when on `/progress`.

- [ ] **Step 3: Commit**

```bash
git add app/progress/page.tsx
git commit -m "feat: add strength progress page with sparklines and drill-down chart"
```
