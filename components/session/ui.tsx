"use client";
// Small phone-sized building blocks for the session screens. 48px+ tap targets, tokens only.
import type { ReactNode } from "react";

export const btn = "min-h-[48px] min-w-[48px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] font-bold active:opacity-70 disabled:opacity-40 select-none touch-manipulation";
export const btnAccent = "min-h-[48px] rounded-xl bg-[var(--color-accent)] text-white font-bold active:opacity-80 disabled:opacity-40 select-none touch-manipulation";
export const chipOn = "bg-[var(--color-accent)] text-white border-[var(--color-accent)]";

/** - value + stepper. `step` is added/subtracted on tap. `value` null shows a dash. */
export function Stepper({ label, value, step, onStep, unit, wide }: {
  label: string; value: number | null; step: number; onStep: (delta: number) => void; unit?: string; wide?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1 ${wide ? "w-full" : ""}`}>
      <button type="button" aria-label={`${label} minus ${step}`} className={btn} onClick={() => onStep(-step)}>−</button>
      <div className="min-w-[64px] flex-1 text-center leading-tight">
        <div className="text-xl font-bold tabular-nums text-[var(--color-text)]">{value ?? "–"}{unit && value != null ? <span className="text-xs font-normal text-[var(--color-text-muted)]"> {unit}</span> : null}</div>
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-faint)]">{label}</div>
      </div>
      <button type="button" aria-label={`${label} plus ${step}`} className={btn} onClick={() => onStep(step)}>+</button>
    </div>
  );
}

/** Row of single-select buttons. Tap the selected one again to clear when `clearable`. */
export function Choice<T extends string | number>({ options, value, onPick, label, clearable }: {
  options: { value: T; label: string }[]; value: T | null; onPick: (v: T | null) => void; label?: string; clearable?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value}
          className={`${btn} flex-1 px-3 text-sm ${value === o.value ? chipOn : ""}`}
          onClick={() => onPick(clearable && value === o.value ? null : o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Bottom sheet over a dimmed backdrop. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[90vh] overflow-y-auto rounded-t-2xl bg-[var(--color-bg)] p-4 pb-8 text-[var(--color-text)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className={btn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
