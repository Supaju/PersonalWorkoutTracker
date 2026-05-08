# Design: Dark Underground UI Redesign

**Date:** 2026-05-08  
**Status:** Approved

## Goal

Retheme WorkoutTracker from its current white/clean/indigo palette to a dark underground aesthetic: near-black backgrounds, blood-red accents, monospace typography, and raw industrial UI patterns. The visual language is a serious gym environment — no softness, no pastels, maximum contrast.

## Approach

Tailwind v4 token-first: define semantic color tokens in `@theme` inside `globals.css`, then replace all existing Tailwind color classes across every page and component with the new tokens. Font loaded via Google Fonts `@import`. One place to change the palette in the future.

## Design System

### Color Tokens (`globals.css @theme`)

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#0a0a0a` | Page background |
| `--color-surface` | `#111111` | Cards, panels, inputs |
| `--color-border` | `#1e1e1e` | Default borders |
| `--color-accent` | `#dc2626` | Red — buttons, active states, highlights |
| `--color-accent-hover` | `#b91c1c` | Button hover |
| `--color-text` | `#e5e5e5` | Primary text |
| `--color-text-muted` | `#a3a3a3` | Secondary text |
| `--color-text-faint` | `#525252` | Labels, timestamps, placeholder |

Old tokens removed: `--color-primary`, `--color-primary-hover`.

### Typography

- Font family: `Space Mono` (Google Fonts, weights 400 and 700)
- Loaded via `@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap')` at the top of `globals.css`
- Applied as root `font-family` on `body` via a `@layer base` block

### UI Patterns

**Active nav item**: Left 2px border in `--color-accent`, label and icon in `--color-accent`, background `--color-surface`.

**Inactive nav item**: Text `--color-text-muted`, hover background `--color-surface`, hover text `--color-text`.

**Primary button** (plan, log, suggest etc.): Red fill (`--color-accent`), black text, all-caps, tight letter-spacing, angular clip-path: `polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))`. Hover: `--color-accent-hover`.

**Secondary / ghost button**: Transparent, `--color-border` border, `--color-text-muted` text. Hover: `--color-surface`.

**Cards / panels**: Background `--color-surface`, border `1px solid --color-border`. Active/highlighted card gets `border-left: 3px solid --color-accent`.

**Section labels**: Uppercase, `letter-spacing: 0.15em`, `--color-text-faint`.

**Progress bars**: Height 3px, dark track (`--color-border`), red fill (`--color-accent`).

**Inputs**: Background `--color-surface`, border `--color-border`, text `--color-text`, focus border `--color-accent`. No rounded corners (border-radius: 0).

## Files Changed

| File | Change |
|---|---|
| `app/globals.css` | Add `@import` for Space Mono; replace `@theme` tokens; add `@layer base` for font-family |
| `app/layout.tsx` | Replace `bg-slate-50 text-slate-900` with dark token classes |
| `components/sidebar.tsx` | Full restyle: dark bg, red active state, monospace labels |
| `app/page.tsx` | Replace all slate/indigo classes with dark token equivalents |
| `app/sessions/page.tsx` | Replace all slate/indigo classes |
| `app/sessions/plan/page.tsx` | Replace all slate/indigo classes |
| `app/sessions/[id]/page.tsx` | Replace all slate/indigo classes |
| `app/sessions/[id]/record/page.tsx` | Replace all slate/indigo classes |
| `app/meals/page.tsx` | Replace all slate/indigo classes |
| `app/equipment/page.tsx` | Replace all slate/indigo classes |
| `app/profile/page.tsx` | Replace all slate/indigo classes |
| `app/ai-review/page.tsx` | Replace all slate/indigo classes |
| `app/sessions/DeleteSessionButton.tsx` | Replace all slate/indigo classes |

## What Does Not Change

- Layout structure (sidebar + main content layout unchanged)
- Component logic, data fetching, API calls
- Responsive breakpoints
- Any functionality

## Tailwind Class Mapping

| Old class | New class |
|---|---|
| `bg-slate-50`, `bg-white` | `bg-[var(--color-bg)]` or `bg-[var(--color-surface)]` |
| `bg-indigo-50`, `bg-indigo-100` | `bg-[var(--color-surface)]` |
| `text-slate-900`, `text-slate-800` | `text-[var(--color-text)]` |
| `text-slate-600`, `text-slate-700` | `text-[var(--color-text-muted)]` |
| `text-slate-400`, `text-slate-500` | `text-[var(--color-text-faint)]` |
| `text-indigo-600`, `text-indigo-700` | `text-[var(--color-accent)]` |
| `bg-indigo-600`, `bg-indigo-700` | `bg-[var(--color-accent)]` |
| `hover:bg-indigo-700` | `hover:bg-[var(--color-accent-hover)]` |
| `border-slate-200`, `border-slate-300` | `border-[var(--color-border)]` |
| `border-indigo-*` | `border-[var(--color-accent)]` |
| `divide-slate-*` | `divide-[var(--color-border)]` |
| `ring-indigo-*`, `focus:ring-indigo-*` | `focus:border-[var(--color-accent)]` (ring → border-focus) |
| `rounded-lg`, `rounded-md` (buttons) | `rounded-none` |
| `rounded-lg`, `rounded-md` (cards) | `rounded-none` |

## Future Changes

To change the accent color: edit `--color-accent` and `--color-accent-hover` in `globals.css`.  
To change the font: swap the Google Fonts `@import` URL and update the `font-family` in `@layer base`.
