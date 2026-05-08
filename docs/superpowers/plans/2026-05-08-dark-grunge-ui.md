# Dark Underground UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme WorkoutTracker from white/indigo to a dark underground aesthetic: near-black backgrounds, blood-red accents, Space Mono font, flat corners, and industrial UI patterns.

**Architecture:** Tailwind v4 token-first approach. New semantic color tokens defined once in `globals.css @theme`. All pages replace existing `slate-*`/`indigo-*`/`white` Tailwind classes with `[var(--color-*)]` equivalents. A `.btn-accent` utility class handles the angular clip-path button used across all primary CTAs.

**Tech Stack:** Next.js App Router, Tailwind CSS v4, Space Mono (Google Fonts)

---

## File Map

| File | Change |
|---|---|
| `app/globals.css` | Font import, new `@theme` tokens, `.btn-accent` utility |
| `app/layout.tsx` | Body background + text classes |
| `components/sidebar.tsx` | Full dark restyle with red left-border active state |
| `lib/templates.ts` | `TEMPLATE_COLORS` — dark badge variants |
| `app/page.tsx` | All class replacements |
| `app/sessions/page.tsx` | All class replacements |
| `app/sessions/DeleteSessionButton.tsx` | All class replacements |
| `app/sessions/plan/page.tsx` | All class replacements |
| `app/sessions/[id]/record/page.tsx` | All class replacements |
| `app/sessions/[id]/page.tsx` | All class replacements |
| `app/meals/page.tsx` | All class replacements |
| `app/equipment/page.tsx` | All class replacements + `CATEGORY_COLORS` |
| `app/profile/page.tsx` | All class replacements |
| `app/ai-review/page.tsx` | All class replacements |

---

## Task 1: Design Tokens, Font, and Utility Classes (`app/globals.css`)

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the entire file**

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
@import "tailwindcss";

@theme {
  --color-bg: #0a0a0a;
  --color-surface: #111111;
  --color-border: #1e1e1e;
  --color-accent: #dc2626;
  --color-accent-hover: #b91c1c;
  --color-text: #e5e5e5;
  --color-text-muted: #a3a3a3;
  --color-text-faint: #525252;
}

@layer base {
  body {
    font-family: 'Space Mono', monospace;
  }
}

@layer utilities {
  .btn-accent {
    background-color: var(--color-accent);
    color: #000;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 0.625rem 1.25rem;
    transition: background-color 0.15s;
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .btn-accent:hover {
    background-color: var(--color-accent-hover);
  }
  .btn-accent:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

- [ ] **Step 2: Verify the dev server renders the font**

```bash
npm run dev
```

Open http://localhost:3000 — the page should use monospace font and have a dark background.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: add dark theme tokens, Space Mono font, btn-accent utility"
```

---

## Task 2: Root Layout + Sidebar (`app/layout.tsx`, `components/sidebar.tsx`)

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/sidebar.tsx`

- [ ] **Step 1: Update `app/layout.tsx`**

Find:
```tsx
      <body className="bg-slate-50 text-slate-900 antialiased">
```

Replace with:
```tsx
      <body className="bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
```

- [ ] **Step 2: Replace `components/sidebar.tsx` entirely**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col">
      <div className="px-6 py-5 border-b border-[var(--color-border)]">
        <h1 className="text-lg font-bold text-[var(--color-accent)] uppercase tracking-widest">WorkoutTracker</h1>
        <p className="text-xs text-[var(--color-text-faint)] mt-0.5 uppercase tracking-wider">Fitness Assistant</p>
      </div>
      <nav className="flex-1 py-4 px-0 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors border-l-2 ${
                active
                  ? "border-l-[var(--color-accent)] bg-[var(--color-bg)] text-[var(--color-accent)]"
                  : "border-l-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
              }`}
            >
              <span className={active ? "text-[var(--color-accent)]" : "text-[var(--color-text-faint)]"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider">Powered by Claude AI</p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx components/sidebar.tsx
git commit -m "style: dark layout and sidebar with red active state"
```

---

## Task 3: Template and Category Color Tokens (`lib/templates.ts`, `app/equipment/page.tsx`)

**Files:**
- Modify: `lib/templates.ts`
- Modify: `app/equipment/page.tsx`

- [ ] **Step 1: Update `TEMPLATE_COLORS` in `lib/templates.ts`**

Find:
```ts
export const TEMPLATE_COLORS: Record<TemplateId, string> = {
  upper_a: "bg-blue-100 text-blue-800",
  lower_a: "bg-green-100 text-green-800",
  upper_b: "bg-violet-100 text-violet-800",
  lower_b: "bg-orange-100 text-orange-800",
};
```

Replace with:
```ts
export const TEMPLATE_COLORS: Record<TemplateId, string> = {
  upper_a: "bg-[#1a0a0a] text-[#f87171]",
  lower_a: "bg-[#0a1a0a] text-[#86efac]",
  upper_b: "bg-[#110a1a] text-[#c4b5fd]",
  lower_b: "bg-[#1a1000] text-[#fdba74]",
};
```

- [ ] **Step 2: Update `CATEGORY_COLORS` in `app/equipment/page.tsx`**

Find:
```ts
const CATEGORY_COLORS: Record<EquipmentCategory, string> = {
  machine: "bg-blue-100 text-blue-700",
  free_weight: "bg-orange-100 text-orange-700",
  bodyweight: "bg-green-100 text-green-700",
  cardio: "bg-rose-100 text-rose-700",
};
```

Replace with:
```ts
const CATEGORY_COLORS: Record<EquipmentCategory, string> = {
  machine: "bg-[#0a0f1a] text-[#93c5fd]",
  free_weight: "bg-[#1a0f00] text-[#fdba74]",
  bodyweight: "bg-[#0a1a0a] text-[#86efac]",
  cardio: "bg-[#1a0a0a] text-[#f87171]",
};
```

- [ ] **Step 3: Commit**

```bash
git add lib/templates.ts app/equipment/page.tsx
git commit -m "style: dark badge colors for templates and equipment categories"
```

---

## Task 4: Dashboard (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Apply all class replacements**

Replace the entire `return (...)` JSX block with the following:

```tsx
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--color-text)] uppercase tracking-wide">
          {profile?.name ? `Welcome back, ${profile.name}` : "Welcome to WorkoutTracker"}
        </h2>
        <p className="text-[var(--color-text-faint)] text-sm mt-1 uppercase tracking-widest">{today}</p>
      </div>

      {!allDone && (
        <div className="bg-[#1a1000] border border-[#3a2800] p-6 mb-8">
          <h3 className="text-xs font-bold text-[#fdba74] mb-3 uppercase tracking-widest">Getting Started</h3>
          <div className="space-y-2">
            {setupSteps.map((step) => (
              <Link key={step.href} href={step.href} className="flex items-center gap-3 text-sm group">
                <span className={`w-5 h-5 flex items-center justify-center shrink-0 border ${step.done ? "bg-[#86efac] border-[#86efac] text-black" : "border-[#3a2800] bg-transparent"}`}>
                  {step.done && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className={step.done ? "text-[var(--color-text-faint)] line-through" : "text-[#fdba74] group-hover:text-[var(--color-text)]"}>{step.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Cycle position + CTA */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--color-text)] uppercase tracking-widest text-xs">Next Session</h3>
            <Link href="/sessions" className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-accent)] uppercase tracking-wider">History</Link>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs font-bold px-3 py-1.5 ${colorClass}`}>{tmpl.label}</span>
            <span className="text-sm text-[var(--color-text-muted)]">is up next</span>
          </div>

          {/* Cycle progress bars */}
          <div className="flex gap-2 mb-5">
            {CYCLE_ORDER.map((t) => (
              <div key={t} className="flex-1 text-center">
                <div className={`h-1 mb-1 ${t === currentTemplate ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"}`} />
                <span className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider">{TEMPLATES[t].label}</span>
              </div>
            ))}
          </div>

          {pendingSession ? (
            <Link
              href={`/sessions/${pendingSession.id}/record`}
              className="btn-accent w-full justify-center text-xs"
            >
              Continue Recording →
            </Link>
          ) : (
            <Link
              href="/sessions/plan"
              className="btn-accent w-full justify-center text-xs"
            >
              Plan This Session →
            </Link>
          )}
        </div>

        {/* Profile summary */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--color-text)] uppercase tracking-widest text-xs">Profile</h3>
            <Link href="/profile" className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-accent)] uppercase tracking-wider">Edit</Link>
          </div>
          {profile ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Goal</dt><dd className="font-medium text-[var(--color-text)]">{GOAL_LABELS[profile.goals as Goal] ?? profile.goals}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Age / Gender</dt><dd className="font-medium text-[var(--color-text)]">{profile.age} / {profile.gender}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Height</dt><dd className="font-medium text-[var(--color-text)]">{formatHeight(profile.heightIn)}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Weight</dt><dd className="font-medium text-[var(--color-text)]">{profile.weightLbs} lbs</dd></div>
            </dl>
          ) : (
            <Link href="/profile" className="text-sm text-[var(--color-accent)] hover:underline">Set up your profile →</Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Last session */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--color-text)] uppercase tracking-widest text-xs">Last Session</h3>
            <Link href="/sessions" className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-accent)] uppercase tracking-wider">All sessions</Link>
          </div>
          {lastRecorded ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2 py-0.5 ${TEMPLATE_COLORS[lastRecorded.template as TemplateId]}`}>
                  {TEMPLATES[lastRecorded.template as TemplateId]?.label}
                </span>
                <span className="text-xs text-[var(--color-text-faint)]">{lastRecorded.date}</span>
              </div>
              <ul className="space-y-1">
                {lastRecorded.exercises.slice(0, 4).map((ex) => {
                  const topSet = ex.sets.sort((a, b) => b.weightLbs - a.weightLbs)[0];
                  return (
                    <li key={ex.id} className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-muted)]">{ex.name}</span>
                      {topSet && <span className="text-[var(--color-text-faint)] text-xs">{topSet.weightLbs} lbs × {topSet.reps}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-faint)]">No recorded sessions yet.</p>
          )}
        </div>

        {/* Nutrition or AI notes */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--color-text)] uppercase tracking-widest text-xs">{mealEntries.length > 0 ? "Today's Nutrition" : "AI Notes"}</h3>
            <Link href={mealEntries.length > 0 ? "/meals" : "/ai-review"} className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-accent)] uppercase tracking-wider">
              {mealEntries.length > 0 ? "Plan" : "Full review"}
            </Link>
          </div>
          {mealEntries.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Calories", value: Math.round(mealTotals.calories), unit: "kcal", color: "text-[#dc2626]" },
                { label: "Protein", value: Math.round(mealTotals.protein), unit: "g", color: "text-[#86efac]" },
                { label: "Carbs", value: Math.round(mealTotals.carbs), unit: "g", color: "text-[#fdba74]" },
                { label: "Fat", value: Math.round(mealTotals.fat), unit: "g", color: "text-[#f87171]" },
              ].map(({ label, value, unit, color }) => (
                <div key={label} className="bg-[var(--color-bg)] border border-[var(--color-border)] p-3 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}<span className="text-xs font-normal ml-0.5">{unit}</span></p>
                  <p className="text-xs text-[var(--color-text-faint)] mt-0.5 uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>
          ) : latestReview ? (
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-6">
              {latestReview.reviewText.slice(0, 300)}{latestReview.reviewText.length > 300 && "..."}
            </p>
          ) : (
            <div className="text-sm text-[var(--color-text-faint)]">
              <p className="mb-2">No AI review yet.</p>
              <Link href="/ai-review" className="text-[var(--color-accent)] hover:underline">Run your first review →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "style: dark theme for dashboard"
```

---

## Task 5: Sessions List + Delete Button (`app/sessions/page.tsx`, `app/sessions/DeleteSessionButton.tsx`)

**Files:**
- Modify: `app/sessions/page.tsx`
- Modify: `app/sessions/DeleteSessionButton.tsx`

- [ ] **Step 1: Replace the return JSX in `app/sessions/page.tsx`**

```tsx
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-[var(--color-text)] uppercase tracking-wide">Sessions</h2>
        <Link
          href="/sessions/plan"
          className="btn-accent text-xs"
        >
          Plan Next Session
        </Link>
      </div>
      <p className="text-[var(--color-text-faint)] text-sm mb-8 uppercase tracking-widest">Your full training history.</p>

      {sessions.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-text-faint)]">
          <p className="text-sm mb-3">No sessions yet.</p>
          <Link href="/sessions/plan" className="text-[var(--color-accent)] hover:underline text-sm">
            Plan your first session →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const label = TEMPLATES[session.template as TemplateId]?.label ?? session.template;
            const colorClass = TEMPLATE_COLORS[session.template as TemplateId] ?? "bg-[var(--color-surface)] text-[var(--color-text-muted)]";
            const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
            const href = session.phase === "planned"
              ? `/sessions/${session.id}/record`
              : `/sessions/${session.id}`;

            return (
              <div
                key={session.id}
                className="group bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
              >
                <Link href={href} className="block px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2.5 py-1 ${colorClass}`}>
                        {label}
                      </span>
                      <span className="text-sm font-medium text-[var(--color-text)]">{session.date}</span>
                      {session.durationMin && (
                        <span className="text-xs text-[var(--color-text-faint)]">{session.durationMin} min</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-[var(--color-text-faint)]">
                        {session.exercises.length} exercises · {totalSets} sets logged
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 uppercase tracking-wider ${
                          session.phase === "recorded"
                            ? "bg-[#0a1a0a] text-[#86efac]"
                            : "bg-[#1a1000] text-[#fdba74]"
                        }`}
                      >
                        {session.phase === "recorded" ? "Recorded" : "Planned"}
                      </span>
                    </div>
                  </div>

                  {session.exercises.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {session.exercises.slice(0, 4).map((ex) => (
                        <span key={ex.id} className="text-xs text-[var(--color-text-faint)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1">
                          {ex.name}
                        </span>
                      ))}
                      {session.exercises.length > 4 && (
                        <span className="text-xs text-[var(--color-text-faint)]">+{session.exercises.length - 4} more</span>
                      )}
                    </div>
                  )}
                </Link>

                <div className="flex justify-end px-4 pb-3 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DeleteSessionButton id={session.id} phase={session.phase} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
```

- [ ] **Step 2: Replace the return JSX in `app/sessions/DeleteSessionButton.tsx`**

```tsx
  if (confirming) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
        <span className="text-xs text-[var(--color-text-muted)]">
          {phase === "recorded" ? "Delete session + all logged sets?" : "Delete planned session?"}
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs font-bold px-2.5 py-1 bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors uppercase tracking-wider"
        >
          {deleting ? "Deleting..." : "Confirm"}
        </button>
        <button
          onClick={handleCancel}
          className="text-xs px-2.5 py-1 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleDelete}
      className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors p-1"
      title="Delete session"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
```

- [ ] **Step 3: Commit**

```bash
git add app/sessions/page.tsx app/sessions/DeleteSessionButton.tsx
git commit -m "style: dark theme for sessions list and delete button"
```

---

## Task 6: Plan Session Page (`app/sessions/plan/page.tsx`)

**Files:**
- Modify: `app/sessions/plan/page.tsx`

- [ ] **Step 1: Replace the return JSX**

```tsx
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

          <div className="flex justify-end">
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
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add app/sessions/plan/page.tsx
git commit -m "style: dark theme for plan session page"
```

---

## Task 7: Record Session Page (`app/sessions/[id]/record/page.tsx`)

**Files:**
- Modify: `app/sessions/[id]/record/page.tsx`

- [ ] **Step 1: Replace the loading state and return JSX**

Find the loading return:
```tsx
  if (!session) return <div className="text-slate-400 text-sm">Loading...</div>;
```
Replace with:
```tsx
  if (!session) return <div className="text-[var(--color-text-faint)] text-sm">Loading...</div>;
```

Replace the entire main `return (...)` JSX block:

```tsx
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-2xl font-bold text-[var(--color-text)] uppercase tracking-wide">Record Session</h2>
        <span className={`text-xs font-bold px-3 py-1 ${colorClass}`}>{label}</span>
        <span className="text-sm text-[var(--color-text-faint)]">{session.date}</span>
      </div>
      <p className="text-[var(--color-text-faint)] text-sm mb-6">Log your actual sets and reps. Use the edit button to swap or remove any exercise.</p>

      {session.notes && (
        <div className="bg-[#110a1a] border border-[#2a1a3a] p-4 mb-6">
          <p className="text-xs font-bold text-[#c4b5fd] mb-1 uppercase tracking-widest">Coach Notes</p>
          <p className="text-sm text-[#c4b5fd]">{session.notes}</p>
        </div>
      )}

      <div className="space-y-6 mb-8">
        {session.exercises.map((ex) => {
          const sets = setData[ex.id] ?? [];
          const isEditing = editingId === ex.id;
          return (
            <div key={ex.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="font-bold text-[var(--color-text)]">{ex.name}</h3>
                  <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
                    Target: {ex.targetSets} × {ex.targetReps}{ex.targetWeight ? ` @ ${ex.targetWeight} lbs` : ""}
                    {ex.muscleGroups ? ` · ${ex.muscleGroups}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(ex)}
                      className="text-xs font-medium px-3 py-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)] transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      onClick={() => saveSets(ex.id)}
                      className={`text-xs font-medium px-3 py-1.5 transition-colors ${
                        saved[ex.id]
                          ? "bg-[#0a1a0a] text-[#86efac] border border-[#1a3a1a]"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      {saved[ex.id] ? "Saved ✓" : "Save Sets"}
                    </button>
                  )}
                </div>
              </div>

              {ex.aiNotes && !isEditing && (
                <p className="text-xs text-[var(--color-text-faint)] italic mb-3">{ex.aiNotes}</p>
              )}

              {isEditing && (
                <div className="mt-3 mb-4 p-4 bg-[var(--color-bg)] border border-[var(--color-border)] space-y-3">
                  <p className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest">Edit Exercise</p>
                  <div>
                    <label className="text-xs text-[var(--color-text-faint)] mb-1 block uppercase tracking-wider">Exercise name</label>
                    <input
                      type="text"
                      value={editDraft.name}
                      onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                      placeholder="e.g. Leg Press"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-faint)] mb-1 block uppercase tracking-wider">Muscle groups</label>
                    <input
                      type="text"
                      value={editDraft.muscleGroups}
                      onChange={(e) => setEditDraft((d) => ({ ...d, muscleGroups: e.target.value }))}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                      placeholder="e.g. Quads, glutes"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div>
                      <label className="text-xs text-[var(--color-text-faint)] mb-1 block uppercase tracking-wider">Sets</label>
                      <input
                        type="number"
                        value={editDraft.targetSets}
                        onChange={(e) => setEditDraft((d) => ({ ...d, targetSets: e.target.value }))}
                        className="w-20 bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm text-center text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--color-text-faint)] mb-1 block uppercase tracking-wider">Rep range</label>
                      <input
                        type="text"
                        value={editDraft.targetReps}
                        onChange={(e) => setEditDraft((d) => ({ ...d, targetReps: e.target.value }))}
                        className="w-24 bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm text-center text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                        placeholder="10-12"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--color-text-faint)] mb-1 block uppercase tracking-wider">Target weight (lbs)</label>
                      <input
                        type="number"
                        value={editDraft.targetWeight}
                        onChange={(e) => setEditDraft((d) => ({ ...d, targetWeight: e.target.value }))}
                        className="w-28 bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm text-center text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                        placeholder="optional"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveEdit}
                      disabled={submitting || !editDraft.name.trim()}
                      className="btn-accent text-xs"
                    >
                      {submitting ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-xs px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => removeExercise(ex.id)}
                      disabled={submitting}
                      className="text-xs px-4 py-2 bg-[#1a0505] border border-[#3a1010] text-[#f87171] hover:bg-[#2a0808] disabled:opacity-50 transition-colors ml-auto"
                    >
                      Remove Exercise
                    </button>
                  </div>
                </div>
              )}

              {!isEditing && (
                <div className="mt-3 space-y-2">
                  {sets.map((s, si) => (
                    <div key={si} className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-faint)] w-10 shrink-0">Set {si + 1}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="0"
                          value={s.weightLbs}
                          onChange={(e) => updateSet(ex.id, si, "weightLbs", e.target.value)}
                          className="w-20 bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1.5 text-sm text-center text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        <span className="text-xs text-[var(--color-text-faint)]">lbs</span>
                      </div>
                      <span className="text-[var(--color-border)]">×</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="0"
                          value={s.reps}
                          onChange={(e) => updateSet(ex.id, si, "reps", e.target.value)}
                          className="w-16 bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1.5 text-sm text-center text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        <span className="text-xs text-[var(--color-text-faint)]">reps</span>
                      </div>
                      <button
                        onClick={() => removeSet(ex.id, si)}
                        className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors ml-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addSet(ex.id)}
                    className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium mt-1"
                  >
                    + Add set
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add new exercise */}
        {addingNew ? (
          <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] p-6 space-y-3">
            <p className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest">Add Exercise</p>
            <div>
              <label className="text-xs text-[var(--color-text-faint)] mb-1 block uppercase tracking-wider">Exercise name</label>
              <input
                type="text"
                value={newDraft.name}
                onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                placeholder="e.g. Cable Row"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-faint)] mb-1 block uppercase tracking-wider">Muscle groups</label>
              <input
                type="text"
                value={newDraft.muscleGroups}
                onChange={(e) => setNewDraft((d) => ({ ...d, muscleGroups: e.target.value }))}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                placeholder="e.g. Lats, biceps"
              />
            </div>
            <div className="flex gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-faint)] mb-1 block uppercase tracking-wider">Sets</label>
                <input
                  type="number"
                  value={newDraft.targetSets}
                  onChange={(e) => setNewDraft((d) => ({ ...d, targetSets: e.target.value }))}
                  className="w-20 bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-center text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-faint)] mb-1 block uppercase tracking-wider">Rep range</label>
                <input
                  type="text"
                  value={newDraft.targetReps}
                  onChange={(e) => setNewDraft((d) => ({ ...d, targetReps: e.target.value }))}
                  className="w-24 bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-center text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="10-12"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-faint)] mb-1 block uppercase tracking-wider">Target weight (lbs)</label>
                <input
                  type="number"
                  value={newDraft.targetWeight}
                  onChange={(e) => setNewDraft((d) => ({ ...d, targetWeight: e.target.value }))}
                  className="w-28 bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-center text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="optional"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={addExercise}
                disabled={submitting || !newDraft.name.trim()}
                className="btn-accent text-xs"
              >
                {submitting ? "Adding..." : "Add to Session"}
              </button>
              <button
                onClick={() => { setAddingNew(false); setNewDraft(blankDraft()); }}
                className="text-xs px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setAddingNew(true); setEditingId(null); }}
            className="w-full py-3 border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-faint)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          >
            + Add an exercise
          </button>
        )}
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 mb-6 space-y-4">
        <h3 className="font-bold text-[var(--color-text)] uppercase tracking-widest text-xs">Wrap Up</h3>
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Session duration (min)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              className="w-24 bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Session notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel? Any issues?"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={() => router.push("/sessions")}
          className="text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
        >
          ← Back to sessions
        </button>
        <button
          onClick={finishSession}
          disabled={saving}
          className="btn-accent"
        >
          {saving ? "Finishing..." : "Finish & Advance Cycle →"}
        </button>
      </div>
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add "app/sessions/[id]/record/page.tsx"
git commit -m "style: dark theme for record session page"
```

---

## Task 8: Session Detail Page (`app/sessions/[id]/page.tsx`)

**Files:**
- Modify: `app/sessions/[id]/page.tsx`

- [ ] **Step 1: Replace the return JSX**

```tsx
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-2xl font-bold text-[var(--color-text)] uppercase tracking-wide">{label}</h2>
        <span className={`text-xs font-bold px-3 py-1 ${colorClass}`}>{session.date}</span>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase tracking-wider ${session.phase === "recorded" ? "bg-[#0a1a0a] text-[#86efac]" : "bg-[#1a1000] text-[#fdba74]"}`}>
          {session.phase === "recorded" ? "Recorded" : "Planned"}
        </span>
      </div>

      <div className="flex gap-4 text-sm text-[var(--color-text-faint)] mb-8">
        {session.durationMin && <span>{session.durationMin} min</span>}
        {totalVolume > 0 && <span>{Math.round(totalVolume).toLocaleString()} lbs total volume</span>}
        {session.phase === "planned" && (
          <Link href={`/sessions/${session.id}/record`} className="text-[var(--color-accent)] font-medium hover:underline">
            Record this session →
          </Link>
        )}
      </div>

      {session.notes && (
        <div className="bg-[#110a1a] border border-[#2a1a3a] p-4 mb-6">
          <p className="text-xs font-bold text-[#c4b5fd] mb-1 uppercase tracking-widest">Coach Notes</p>
          <p className="text-sm text-[#c4b5fd]">{session.notes}</p>
        </div>
      )}

      <div className="space-y-4">
        {session.exercises.map((ex) => (
          <div key={ex.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-bold text-[var(--color-text)]">{ex.name}</h3>
              <span className="text-xs text-[var(--color-text-faint)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-0.5">{ex.muscleGroups}</span>
            </div>
            <p className="text-xs text-[var(--color-text-faint)] mb-3">Target: {ex.targetSets} sets × {ex.targetReps} reps{ex.targetWeight ? ` @ ${ex.targetWeight} lbs` : ""}</p>

            {ex.aiNotes && <p className="text-xs text-[var(--color-text-faint)] italic mb-3">{ex.aiNotes}</p>}

            {ex.sets.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {ex.sets.map((s) => (
                  <div key={s.id} className="text-center bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 min-w-[60px]">
                    <p className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider">Set {s.setNumber}</p>
                    <p className="font-bold text-[var(--color-text)] text-sm">{s.weightLbs}<span className="text-xs font-normal"> lbs</span></p>
                    <p className="text-xs text-[var(--color-text-muted)]">{s.reps} reps</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-faint)]">No sets recorded yet.</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link href="/sessions" className="text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)]">← Back to sessions</Link>
      </div>
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add "app/sessions/[id]/page.tsx"
git commit -m "style: dark theme for session detail page"
```

---

## Task 9: Meals Page (`app/meals/page.tsx`)

**Files:**
- Modify: `app/meals/page.tsx`

- [ ] **Step 1: Replace the return JSX**

```tsx
  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">Meals</h2>
      <p className="text-[var(--color-text-faint)] text-sm mb-8">Build your food library, generate AI meal plans, and analyze anything you eat.</p>

      <div className="grid grid-cols-2 gap-8">
        {/* ── Food Library ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--color-text)] uppercase tracking-widest text-xs">Food Library</h3>
            <button
              onClick={() => setShowFoodForm(!showFoodForm)}
              className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium uppercase tracking-wider"
            >
              {showFoodForm ? "Cancel" : "+ Add food"}
            </button>
          </div>

          {showFoodForm && (
            <form onSubmit={handleAddFood} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 mb-4 space-y-2">
              <input required placeholder="Food name" value={foodForm.name}
                onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]" />
              <input placeholder="Serving size (e.g. 100g)" value={foodForm.serving}
                onChange={(e) => setFoodForm({ ...foodForm, serving: e.target.value })}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]" />
              <div className="grid grid-cols-2 gap-2">
                {(["calories", "protein", "carbs", "fat"] as const).map((field) => (
                  <input key={field} required type="number" min={0} step={0.1}
                    placeholder={field.charAt(0).toUpperCase() + field.slice(1) + (field === "calories" ? " (kcal)" : " (g)")}
                    value={foodForm[field]}
                    onChange={(e) => setFoodForm({ ...foodForm, [field]: e.target.value })}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]" />
                ))}
              </div>
              <button type="submit" disabled={addingFood}
                className="btn-accent w-full justify-center text-xs">
                {addingFood ? "Adding..." : "Add Food"}
              </button>
            </form>
          )}

          <div className="space-y-2">
            {foods.length === 0 && <p className="text-[var(--color-text-faint)] text-sm">No foods yet.</p>}
            {foods.map((food) => (
              <div key={food.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{food.name}</p>
                    {food.serving && <p className="text-xs text-[var(--color-text-faint)]">{food.serving}</p>}
                  </div>
                  <button onClick={() => handleDeleteFood(food.id)} className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-[var(--color-text-faint)]">
                  <span>{food.calories} kcal</span>
                  <span>P: {food.protein}g</span>
                  <span>C: {food.carbs}g</span>
                  <span>F: {food.fat}g</span>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {MEAL_SLOTS.map(({ slot, label }) => (
                    <button key={slot} onClick={() => addEntry(slot, food.id)}
                      className="text-xs px-2 py-0.5 border border-[var(--color-border)] text-[var(--color-text-faint)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
                      + {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Daily Meal Plan ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--color-text)] uppercase tracking-widest text-xs">Today&apos;s Plan</h3>
            <span className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider">{today}</span>
          </div>

          {/* AI generate button */}
          <button
            onClick={generateAIPlan}
            disabled={generating}
            className="btn-accent w-full justify-center mb-4 text-xs"
          >
            {generating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating plan...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate AI Meal Plan
              </>
            )}
          </button>

          {planError && (
            <div className="mb-4 bg-[#1a0505] border border-[#3a1010] text-[#f87171] text-sm p-3">{planError}</div>
          )}

          {planNotes && (
            <div className="mb-4 bg-[#110a1a] border border-[#2a1a3a] p-3">
              <p className="text-xs font-bold text-[#c4b5fd] mb-1 uppercase tracking-widest">Nutrition Notes</p>
              <p className="text-sm text-[#c4b5fd]">{planNotes}</p>
            </div>
          )}

          <div className="space-y-3 mb-4">
            {MEAL_SLOTS.map(({ slot, label }) => {
              const slotEntries = entries.map((e, i) => ({ ...e, idx: i })).filter((e) => e.slot === slot);
              return (
                <div key={slot} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
                  <h4 className="text-xs font-bold text-[var(--color-text-faint)] mb-2 uppercase tracking-widest">{label}</h4>
                  {slotEntries.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-faint)]">Nothing added</p>
                  ) : (
                    <ul className="space-y-1">
                      {slotEntries.map(({ idx, foodItemId, quantity }) => {
                        const food = foods.find((f) => f.id === foodItemId);
                        if (!food) return null;
                        return (
                          <li key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-[var(--color-text-muted)]">
                              {quantity > 1 && <span className="text-[var(--color-text-faint)] text-xs mr-1">{quantity}×</span>}
                              {food.name}
                            </span>
                            <div className="flex items-center gap-3 text-xs text-[var(--color-text-faint)]">
                              <span>{Math.round(food.calories * quantity)} kcal</span>
                              <button onClick={() => removeEntry(idx)} className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)]">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {entries.length > 0 && (
            <div className="bg-[var(--color-bg)] border border-[var(--color-border)] p-4 mb-4">
              <h4 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-2">Daily Totals</h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Calories", value: Math.round(totals.calories), unit: "kcal", color: "text-[#dc2626]" },
                  { label: "Protein", value: Math.round(totals.protein), unit: "g", color: "text-[#86efac]" },
                  { label: "Carbs", value: Math.round(totals.carbs), unit: "g", color: "text-[#fdba74]" },
                  { label: "Fat", value: Math.round(totals.fat), unit: "g", color: "text-[#f87171]" },
                ].map(({ label, value, unit, color }) => (
                  <div key={label}>
                    <p className={`text-lg font-bold ${color}`}>{value}<span className="text-xs font-normal ml-0.5">{unit}</span></p>
                    <p className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={savePlan} disabled={saving || entries.length === 0}
            className="btn-accent w-full justify-center mb-6 text-xs">
            {saving ? "Saving..." : saved ? "Saved!" : "Save Meal Plan"}
          </button>

          {/* ── Deviation Analyzer ── */}
          <div className="border-t border-[var(--color-border)] pt-6">
            <button
              onClick={() => { setShowDeviation(!showDeviation); setAnalysisResult(""); }}
              className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-3 uppercase tracking-widest"
            >
              <svg className={`w-4 h-4 transition-transform ${showDeviation ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Analyze Something I Ate
            </button>

            {showDeviation && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--color-text-faint)]">Describe anything you ate or plan to eat — on or off plan. Claude will break down the nutrition and help you course-correct.</p>
                <textarea
                  value={deviationText}
                  onChange={(e) => setDeviationText(e.target.value)}
                  placeholder={`e.g. "I had a Big Mac, large fries, and a Coke"`}
                  rows={3}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                />
                <button
                  onClick={analyzeDeviation}
                  disabled={analyzing || !deviationText.trim()}
                  className="btn-accent w-full justify-center text-xs"
                >
                  {analyzing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing...
                    </>
                  ) : "Analyze Nutrition"}
                </button>

                {analysisResult && (
                  <div
                    ref={analysisRef}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)] whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto"
                  >
                    {analysisResult}
                    {analyzing && <span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] ml-0.5 animate-pulse align-middle" />}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add app/meals/page.tsx
git commit -m "style: dark theme for meals page"
```

---

## Task 10: Equipment Page (`app/equipment/page.tsx`)

**Files:**
- Modify: `app/equipment/page.tsx`

Note: `CATEGORY_COLORS` was already updated in Task 3. This task handles only the page's structural class replacements.

- [ ] **Step 1: Replace the return JSX**

```tsx
  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">Equipment</h2>
      <p className="text-[var(--color-text-faint)] text-sm mb-8">Add what you have access to — Claude uses this to tailor exercise recommendations.</p>

      <form onSubmit={handleAdd} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 mb-8 flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Equipment name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Barbell, Treadmill, Pull-up bar"
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as EquipmentCategory })}
            className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={adding}
          className="btn-accent text-xs"
        >
          {adding ? "Adding..." : "Add Equipment"}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-[var(--color-text-faint)] text-sm">No equipment added yet.</p>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map(([cat, label]) =>
            grouped[cat].length > 0 ? (
              <div key={cat}>
                <h3 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-2">{label}</h3>
                <div className="flex flex-wrap gap-2">
                  {grouped[cat].map((item) => (
                    <span
                      key={item.id}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium ${CATEGORY_COLORS[cat as EquipmentCategory]}`}
                    >
                      {item.name}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="opacity-60 hover:opacity-100 transition-opacity ml-1"
                        aria-label={`Remove ${item.name}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add app/equipment/page.tsx
git commit -m "style: dark theme for equipment page"
```

---

## Task 11: Profile Page (`app/profile/page.tsx`)

**Files:**
- Modify: `app/profile/page.tsx`

- [ ] **Step 1: Replace the loading return and entire return JSX**

Loading state:
```tsx
  if (loading) return <div className="text-[var(--color-text-faint)] text-sm">Loading...</div>;
```

Main return:
```tsx
  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">Your Profile</h2>
      <p className="text-[var(--color-text-faint)] text-sm mb-8">This information shapes all AI recommendations.</p>

      <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 space-y-6 max-w-lg">
        <div>
          <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Name (optional)</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Your name"
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Age</label>
            <input
              type="number"
              required
              min={10}
              max={100}
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="28"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Gender</label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Height</label>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                required
                min={3}
                max={8}
                value={form.heightFt}
                onChange={(e) => setForm({ ...form, heightFt: e.target.value })}
                placeholder="5"
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <span className="text-sm text-[var(--color-text-faint)] shrink-0">ft</span>
            </div>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                required
                min={0}
                max={11}
                value={form.heightIn}
                onChange={(e) => setForm({ ...form, heightIn: e.target.value })}
                placeholder="10"
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <span className="text-sm text-[var(--color-text-faint)] shrink-0">in</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Weight</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              required
              min={60}
              max={700}
              step={0.5}
              value={form.weightLbs}
              onChange={(e) => setForm({ ...form, weightLbs: e.target.value })}
              placeholder="175"
              className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <span className="text-sm text-[var(--color-text-faint)] shrink-0">lbs</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Primary Goal</label>
          <div className="space-y-2">
            {GOALS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="goal"
                  value={value}
                  checked={form.goals === value}
                  onChange={() => setForm({ ...form, goals: value })}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-accent w-full justify-center text-xs"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Profile"}
        </button>
      </form>
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add app/profile/page.tsx
git commit -m "style: dark theme for profile page"
```

---

## Task 12: AI Review Page (`app/ai-review/page.tsx`)

**Files:**
- Modify: `app/ai-review/page.tsx`

- [ ] **Step 1: Replace the return JSX**

```tsx
  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">AI Review</h2>
      <p className="text-[var(--color-text-faint)] text-sm mb-8">
        Claude analyzes your entire plan — profile, workout frequency, exercise selection, and nutrition — and flags anything that doesn&apos;t match your goals.
      </p>

      <div className="flex gap-8">
        {/* Main review area */}
        <div className="flex-1">
          <button
            onClick={handleReview}
            disabled={streaming}
            className="btn-accent w-full justify-center mb-6"
          >
            {streaming ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing your plan...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Run AI Review
              </>
            )}
          </button>

          {error && (
            <div className="mb-4 bg-[#1a0505] border border-[#3a1010] text-[#f87171] text-sm p-4">
              {error}
            </div>
          )}

          {displayText && (
            <div
              ref={streamRef}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 text-sm text-[var(--color-text-muted)] max-w-none overflow-y-auto max-h-[600px]"
              style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
            >
              {displayText}
              {streaming && <span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] ml-0.5 animate-pulse align-middle" />}
            </div>
          )}

          {!displayText && !streaming && !error && (
            <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-faint)]">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-sm">Run a review to get Claude&apos;s analysis of your plan.</p>
              <p className="text-xs mt-1 opacity-70">Requires a profile, workout plan, and ANTHROPIC_API_KEY</p>
            </div>
          )}
        </div>

        {/* History sidebar */}
        {history.length > 0 && (
          <div className="w-52 shrink-0">
            <h3 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-3">Past Reviews</h3>
            <div className="space-y-2">
              {history.map((review) => (
                <button
                  key={review.id}
                  onClick={() => setSelectedReview(selectedReview?.id === review.id ? null : review)}
                  className={`w-full text-left px-3 py-2.5 border text-xs transition-colors ${
                    selectedReview?.id === review.id
                      ? "border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)]"
                  }`}
                >
                  <p className="font-medium">{formatDate(review.createdAt)}</p>
                  <p className="text-[var(--color-text-faint)] mt-0.5 line-clamp-2">{review.reviewText.slice(0, 60)}...</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no new errors beyond the 32 pre-existing implicit-any errors in `app/page.tsx`, `app/sessions/`, and callbacks in `lib/ai.ts` (these existed before this work and are unrelated to the retheme).

- [ ] **Step 3: Commit**

```bash
git add app/ai-review/page.tsx
git commit -m "style: dark theme for AI review page"
```

---

## Manual Verification

Start the dev server and visit each page:

```bash
npm run dev
```

| Page | URL | What to check |
|---|---|---|
| Dashboard | http://localhost:3000 | Dark bg, red accent CTA, monospace font, cycle progress bars |
| Sessions | http://localhost:3000/sessions | Dark cards, template color badges, hover red border |
| Plan session | http://localhost:3000/sessions/plan | Template picker with dark selected state, angular AI button |
| Meals | http://localhost:3000/meals | Food library, AI plan button, deviation analyzer |
| Equipment | http://localhost:3000/equipment | Category color badges, dark form |
| Profile | http://localhost:3000/profile | Dark form inputs, radio buttons |
| AI Review | http://localhost:3000/ai-review | Run button, streaming cursor, history sidebar |
| Sidebar | All pages | Red left-border active state, uppercase tracking labels |
