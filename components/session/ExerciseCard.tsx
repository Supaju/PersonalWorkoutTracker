"use client";
// One exercise in focus: the set in progress is expanded (steppers, RIR row, confirm); the rest are one-line summaries.
import { useState } from "react";
import type { LiveAction, LiveExercise, LiveSet, SetField } from "@/lib/live-session";
import { loadText } from "./types";
import CardioEntry from "./CardioEntry";
import { Stepper, btn, btnAccent, chipOn } from "./ui";

const RIR = [0, 1, 2, 3, 4];

function summary(ex: LiveExercise, s: LiveSet): string {
  const parts: string[] = [];
  if (s.weightLbs != null) parts.push(loadText(ex.unit, s.weightLbs));
  if (s.reps != null) parts.push(`× ${s.reps}`);
  if (s.durationSec != null) parts.push(`${s.durationSec}s`);
  if (s.distanceYd != null) parts.push(`${s.distanceYd} yd`);
  return parts.join(" ") || (ex.unit === "bodyweight" ? "BW" : "—");
}

function SetPanel({ ex, s, n, act }: { ex: LiveExercise; s: LiveSet; n: number; act: (a: LiveAction) => void }) {
  const adj = (field: SetField, delta: number) => act({ t: "adjust", ex: ex.id, set: s.id, field, delta });
  const showWeight = ["total", "per_hand", "distance"].includes(ex.unit) || s.weightLbs != null;
  const showReps = ["total", "per_hand", "bodyweight"].includes(ex.unit) || s.reps != null;
  const showTime = ex.unit === "time" || s.durationSec != null;
  const showDist = ex.unit === "distance" || s.distanceYd != null;
  return (
    <div className="space-y-3 rounded-xl border-2 border-[var(--color-accent)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-bold">Set {n}</div>
        <button type="button" className={`${btn} px-4 text-sm`} onClick={() => act({ t: "toggleType", ex: ex.id, set: s.id })} aria-label="Toggle ramp or working">
          {s.setType === "ramp" ? "Ramp (tap: working)" : "Working (tap: ramp)"}
        </button>
      </div>
      {showWeight && <Stepper label={ex.unit === "per_hand" ? "lb per hand" : "weight"} unit="lb" value={s.weightLbs} step={5} onStep={(d) => adj("weightLbs", d)} wide />}
      {showReps && <Stepper label="reps" value={s.reps} step={1} onStep={(d) => adj("reps", d)} wide />}
      {showTime && <Stepper label="seconds" unit="s" value={s.durationSec} step={5} onStep={(d) => adj("durationSec", d)} wide />}
      {showDist && <Stepper label="yards" unit="yd" value={s.distanceYd} step={10} onStep={(d) => adj("distanceYd", d)} wide />}
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--color-text-faint)]">
          Reps left (RIR){s.targetRir != null ? ` · target ${s.targetRir}` : ""}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {RIR.map((v) => (
            <button key={v} type="button" aria-pressed={s.rir === v} className={`${btn} ${s.rir === v ? chipOn : ""}`}
              onClick={() => act({ t: "setRir", ex: ex.id, set: s.id, value: v })}>{v === 4 ? "4+" : v}</button>
          ))}
        </div>
      </div>
      <button type="button" className={`${btnAccent} w-full min-h-[56px] text-lg`} onClick={() => act({ t: "confirm", ex: ex.id, set: s.id, now: Date.now() })}>
        ✓ Log set
      </button>
      <div className="flex gap-2">
        <button type="button" className={`${btn} flex-1 text-sm`} onClick={() => act({ t: "abandon", ex: ex.id, set: s.id, newId: crypto.randomUUID() })}>
          Abandoned attempt
        </button>
        <button type="button" className={`${btn} text-sm px-4`} aria-label="Remove set" onClick={() => act({ t: "removeSet", ex: ex.id, set: s.id })}>Remove</button>
      </div>
    </div>
  );
}

export default function ExerciseCard({ ex, label, act, onSkip, onSwap, onTag, canUp, canDown }: {
  ex: LiveExercise; label: string | null; act: (a: LiveAction) => void;
  onSkip: () => void; onSwap: () => void; onTag: () => void; canUp: boolean; canDown: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const firstOpen = ex.sets.find((s) => !s.done)?.id ?? null;
  const expanded = open && ex.sets.some((s) => s.id === open && !s.done) ? open : firstOpen;

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold leading-tight">{label ? `${label} · ` : ""}{ex.name}</h2>
          {ex.unit === "per_hand" && <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs">per hand</span>}
        </div>
        {ex.swappedFrom && <div className="text-xs text-[var(--color-text-muted)]">Swapped from {ex.swappedFrom}</div>}
        {ex.cue && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{ex.cue}</p>}
        {ex.whyTarget && <p className="mt-1 text-xs italic text-[var(--color-text-faint)]">{ex.whyTarget}</p>}
      </div>

      {ex.skipped ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-[var(--color-border)] p-3">
          <span>Skipped{ex.skipReason ? ` (${ex.skipReason})` : ""}</span>
          <button type="button" className={`${btn} px-4`} onClick={() => act({ t: "unskip", ex: ex.id })}>Undo</button>
        </div>
      ) : ex.cardio ? (
        <CardioEntry cardio={ex.cardio} onPatch={(patch) => act({ t: "cardio", ex: ex.id, patch })}
          onConfirm={() => act({ t: "confirmCardio", ex: ex.id })} onUnconfirm={() => act({ t: "unconfirmCardio", ex: ex.id })} />
      ) : (
        <div className="space-y-2">
          {ex.sets.map((s, i) =>
            s.id === expanded ? <SetPanel key={s.id} ex={ex} s={s} n={i + 1} act={act} /> : (
              <button key={s.id} type="button"
                onClick={() => (s.done ? act({ t: "unconfirm", ex: ex.id, set: s.id }) : setOpen(s.id))}
                className={`flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl border px-3 text-left ${s.done ? "border-[var(--color-border)] opacity-80" : "border-[var(--color-border)]"} ${s.setType === "abandoned" ? "border-dashed" : ""}`}>
                <span className="flex items-center gap-2">
                  <span className="w-5 text-[var(--color-accent)]">{s.done ? "✓" : ""}</span>
                  <span className="text-sm text-[var(--color-text-muted)]">{i + 1}</span>
                  <span className={s.setType === "ramp" ? "text-[var(--color-text-muted)]" : "font-bold"}>{summary(ex, s)}</span>
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {s.setType === "abandoned" ? "abandoned" : s.setType === "ramp" ? "ramp" : s.rir != null ? `RIR ${s.rir === 4 ? "4+" : s.rir}` : s.done ? "" : "work"}
                  {s.done ? " · edit" : ""}
                </span>
              </button>
            ))}
          <button type="button" className={`${btn} w-full text-sm`} onClick={() => act({ t: "addSet", ex: ex.id, id: crypto.randomUUID() })}>+ Add set</button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 text-sm">
        <button type="button" className={btn} onClick={onTag}>Tag</button>
        <button type="button" className={btn} onClick={onSwap}>Swap</button>
        <button type="button" className={btn} onClick={onSkip} disabled={ex.skipped}>Skip</button>
        <button type="button" className={btn} onClick={() => setMore(!more)} aria-expanded={more}>More</button>
      </div>
      {more && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <button type="button" className={btn} disabled={!canUp} onClick={() => act({ t: "move", ex: ex.id, dir: -1 })}>Move earlier</button>
          <button type="button" className={btn} disabled={!canDown} onClick={() => act({ t: "move", ex: ex.id, dir: 1 })}>Move later</button>
        </div>
      )}
      {ex.tags.length > 0 && <div className="text-xs text-[var(--color-text-muted)]">Tagged: {ex.tags.map((t) => t.replace(/_/g, " ")).join(", ")}</div>}
    </section>
  );
}
