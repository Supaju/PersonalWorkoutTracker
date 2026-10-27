"use client";
// Skip (with reasons), swap (approved substitutes first) and add-exercise sheets for the live screen.
import { useState } from "react";
import type { Preference } from "./types";
import { Sheet, btn, btnAccent } from "./ui";

const REASONS: { value: string; label: string }[] = [
  { value: "time", label: "Out of time" }, { value: "fatigue", label: "Too tired" }, { value: "pain", label: "Pain" },
  { value: "equipment", label: "Equipment" }, { value: "disliked", label: "Didn't like it" }, { value: "other", label: "Other" },
];

export function SkipSheet({ name, onSkip, onClose }: { name: string; onSkip: (reason: string) => void; onClose: () => void }) {
  const [asked, setAsked] = useState(false);
  const [saved, setSaved] = useState(false);
  const never = async () => {
    try { await fetch("/api/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exerciseName: name, kind: "disliked" }) }); setSaved(true); } catch { /* offer stays */ }
  };
  if (asked) {
    return (
      <Sheet title="Never program this again?" onClose={onClose}>
        <p className="mb-3 text-[var(--color-text-muted)]">Skipped {name}. Should the coach stop picking it?</p>
        {saved ? <p className="mb-3 font-bold">Saved. The coach will avoid it.</p> : (
          <button type="button" className={`${btnAccent} mb-2 w-full`} onClick={never}>Yes, never again</button>
        )}
        <button type="button" className={`${btn} w-full`} onClick={onClose}>{saved ? "Done" : "Not now"}</button>
      </Sheet>
    );
  }
  return (
    <Sheet title={`Skip ${name}?`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {REASONS.map((r) => (
          <button key={r.value} type="button" className={`${btn} px-2`} onClick={() => { onSkip(r.value); if (r.value === "disliked") setAsked(true); else onClose(); }}>{r.label}</button>
        ))}
      </div>
    </Sheet>
  );
}

function NameList({ names, label, onPick }: { names: string[]; label: string; onPick: (n: string) => void }) {
  if (!names.length) return null;
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs uppercase tracking-wide text-[var(--color-text-faint)]">{label}</div>
      <div className="flex flex-col gap-2">{names.map((n) => <button key={n} type="button" className={`${btn} px-3 text-left`} onClick={() => onPick(n)}>{n}</button>)}</div>
    </div>
  );
}

function FreeText({ placeholder, cta, onSubmit }: { placeholder: string; cta: string; onSubmit: (n: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder}
        className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-text)]" />
      <button type="button" className={`${btnAccent} px-4`} disabled={!v.trim()} onClick={() => onSubmit(v.trim())}>{cta}</button>
    </div>
  );
}

export function SwapSheet({ name, prefs, onSwap, onClose }: { name: string; prefs: Preference[]; onSwap: (n: string) => void; onClose: () => void }) {
  const approved = prefs.filter((p) => p.kind === "substitute" && p.substituteFor === name).map((p) => p.exerciseName);
  const preferred = prefs.filter((p) => p.kind === "preferred" && p.exerciseName !== name).map((p) => p.exerciseName);
  const pick = (n: string) => { onSwap(n); onClose(); };
  return (
    <Sheet title={`Swap ${name}`} onClose={onClose}>
      <NameList names={approved} label="Approved substitutes" onPick={pick} />
      <NameList names={preferred} label="Preferred" onPick={pick} />
      <FreeText placeholder="Other exercise" cta="Swap" onSubmit={pick} />
    </Sheet>
  );
}

export function AddExerciseSheet({ prefs, onAdd, onClose }: { prefs: Preference[]; onAdd: (n: string) => void; onClose: () => void }) {
  const preferred = [...new Set(prefs.filter((p) => p.kind === "preferred" || p.kind === "substitute").map((p) => p.exerciseName))];
  const pick = (n: string) => { onAdd(n); onClose(); };
  return (
    <Sheet title="Add exercise" onClose={onClose}>
      <NameList names={preferred} label="Your usual" onPick={pick} />
      <FreeText placeholder="Exercise name" cta="Add" onSubmit={pick} />
    </Sheet>
  );
}
