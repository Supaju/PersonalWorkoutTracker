"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type SetType = "ramp" | "working" | "abandoned";
type LoadUnit = "total" | "per_hand" | "bodyweight";
type CardioMachine = "recumbent_bike" | "treadmill" | "elliptical" | "rower" | "sled" | "other";

interface StrengthSet {
  weightLbs: number | null;
  reps: number | null;
  setType: SetType;
  rir: number | null;
}

interface StrengthRow {
  name: string;
  unit: LoadUnit;
  sets: StrengthSet[];
}

interface CardioRow {
  machine: CardioMachine | "";
  minutes: number | null;
  distance: number | null;
  heartRate: number | null;
  calories: number | null;
}

export default function LogWorkoutPage() {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [strengthRows, setStrengthRows] = useState<StrengthRow[]>([
    { name: "", unit: "total", sets: Array(6).fill(null).map(() => ({ weightLbs: null, reps: null, setType: "working", rir: null })) },
    { name: "", unit: "total", sets: Array(6).fill(null).map(() => ({ weightLbs: null, reps: null, setType: "working", rir: null })) },
    { name: "", unit: "total", sets: Array(6).fill(null).map(() => ({ weightLbs: null, reps: null, setType: "working", rir: null })) },
    { name: "", unit: "total", sets: Array(6).fill(null).map(() => ({ weightLbs: null, reps: null, setType: "working", rir: null })) },
  ]);

  const [cardioRows, setCardioRows] = useState<CardioRow[]>([
    { machine: "", minutes: null, distance: null, heartRate: null, calories: null },
  ]);

  const [expandedSet, setExpandedSet] = useState<{ row: number; set: number } | null>(null);

  const addStrengthRow = () => {
    setStrengthRows((prev) => [...prev, { name: "", unit: "total", sets: Array(6).fill(null).map(() => ({ weightLbs: null, reps: null, setType: "working", rir: null })) }]);
  };

  const addCardioRow = () => {
    setCardioRows((prev) => [...prev, { machine: "", minutes: null, distance: null, heartRate: null, calories: null }]);
  };

  const updateStrengthRow = (idx: number, field: "name" | "unit", value: string) => {
    setStrengthRows((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, [field]: field === "unit" ? value as LoadUnit : value } : row
      )
    );
  };

  const updateSet = (rowIdx: number, setIdx: number, field: keyof StrengthSet, value: any) => {
    setStrengthRows((prev) =>
      prev.map((row, i) =>
        i === rowIdx
          ? {
              ...row,
              sets: row.sets.map((set, si) =>
                si === setIdx ? { ...set, [field]: value } : set
              ),
            }
          : row
      )
    );
  };

  const toggleRir = (rowIdx: number, setIdx: number, rir: number) => {
    setStrengthRows((prev) =>
      prev.map((row, i) =>
        i === rowIdx
          ? {
              ...row,
              sets: row.sets.map((set, si) =>
                si === setIdx ? { ...set, rir: set.rir === rir ? null : rir } : set
              ),
            }
          : row
      )
    );
  };

  const updateCardioRow = (idx: number, field: "machine" | "minutes" | "distance" | "heartRate" | "calories", value: any) => {
    setCardioRows((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, [field]: value } : row
      )
    );
  };

  const machineOptions: { value: CardioMachine; label: string }[] = [
    { value: "recumbent_bike", label: "Recumbent bike" },
    { value: "treadmill", label: "Treadmill" },
    { value: "elliptical", label: "Elliptical" },
    { value: "rower", label: "Rower" },
    { value: "sled", label: "Sled" },
    { value: "other", label: "Other" },
  ];

  const saveWorkout = async () => {
    setError("");

    // Validate: at least one exercise
    const hasValidStrength = strengthRows.some((row) => row.name && row.sets.some((set) => set.weightLbs !== null || set.reps !== null));
    const hasValidCardio = cardioRows.some((row) => row.machine && row.minutes);

    if (!hasValidStrength && !hasValidCardio) {
      setError("Add at least one exercise");
      return;
    }

    setSaving(true);
    try {
      // Build exercises array
      const exercises: any[] = [];

      // Add strength exercises
      strengthRows.forEach((row) => {
        if (row.name && row.sets.some((set) => set.weightLbs !== null || set.reps !== null)) {
          const sets = row.sets
            .filter((set) => set.weightLbs !== null || set.reps !== null)
            .map((set) => ({
              setType: set.setType,
              weightLbs: set.weightLbs,
              reps: set.reps,
              rir: set.rir,
            }));

          exercises.push({
            name: row.name,
            unit: row.unit,
            block: "strength",
            muscleGroups: [],
            sets,
          });
        }
      });

      // Add cardio exercises (without cardio data)
      cardioRows.forEach((row) => {
        if (row.machine && row.minutes) {
          const machineLabel = machineOptions.find((m) => m.value === row.machine)?.label || row.machine;
          exercises.push({
            name: machineLabel,
            unit: "cardio",
            block: "conditioning",
            muscleGroups: [],
            sets: [],
          });
        }
      });

      if (exercises.length === 0) {
        setError("Add at least one exercise");
        return;
      }

      // POST session
      const sessionRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          name: name || null,
          notes: notes || null,
          durationMin: durationMin || null,
          exercises,
        }),
      });

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) {
        setError(sessionData.error || "Failed to save session");
        return;
      }

      // PUT cardio details for each cardio exercise
      let cardioIndex = 0;
      for (const row of cardioRows) {
        if (row.machine && row.minutes) {
          // Find the corresponding exercise in the response
          const cardioExercises = sessionData.exercises.filter(
            (ex: any) => ex.unit === "cardio"
          );

          if (cardioIndex < cardioExercises.length) {
            const cardioEx = cardioExercises[cardioIndex];
            const cardioPayload: any = {
              machine: row.machine,
              minutes: row.minutes,
            };

            if (row.distance !== null) cardioPayload.distanceMi = row.distance;
            if (row.heartRate !== null) cardioPayload.heartRate = row.heartRate;
            if (row.calories !== null) cardioPayload.calories = row.calories;

            const cardioRes = await fetch(`/api/sessions/${sessionData.id}/exercises/${cardioEx.id}/cardio`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cardioPayload),
            });

            if (!cardioRes.ok) {
              const cardioError = await cardioRes.json();
              console.error("Cardio error:", cardioError);
              // Continue anyway; the base session is saved
            }

            cardioIndex++;
          }
        }
      }

      router.push(`/sessions/${sessionData.id}`);
    } catch (err) {
      console.error("Error saving workout:", err);
      setError("Failed to connect");
    } finally {
      setSaving(false);
    }
  };

  const machineLabel = (machine: CardioMachine | "") => {
    return machineOptions.find((m) => m.value === machine)?.label || "";
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--color-text)] uppercase tracking-wide mb-8">Log a workout</h1>

      {error && (
        <div className="bg-[#2a1a1a] border border-[#6b3a3a] text-[#fca5a5] text-sm px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Date, Name, Duration */}
      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 min-h-[44px] text-[var(--color-text)] text-base"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
            Workout name (optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Upper A"
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 min-h-[44px] text-[var(--color-text)] text-base placeholder-[var(--color-text-faint)]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
            Duration (optional, minutes)
          </label>
          <input
            type="number"
            value={durationMin ?? ""}
            onChange={(e) => setDurationMin(e.target.value ? parseInt(e.target.value) : null)}
            inputMode="numeric"
            placeholder="45"
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 min-h-[44px] text-[var(--color-text)] text-base placeholder-[var(--color-text-faint)]"
          />
        </div>
      </div>

      {/* Strength Section */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-4 uppercase tracking-wide">Strength</h2>

        <div className="overflow-x-auto">
          {/* Header */}
          <div className="flex gap-4 pb-2 border-b border-[var(--color-border)] min-w-min">
            <div className="w-32 flex-shrink-0 text-xs font-bold text-[var(--color-text-muted)] uppercase sticky left-0 bg-[var(--color-bg)] z-10">Exercise</div>
            <div className="w-24 flex-shrink-0 text-xs font-bold text-[var(--color-text-muted)] uppercase">Unit</div>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="w-[88px] flex-shrink-0 text-xs font-bold text-[var(--color-text-muted)] text-center uppercase">
                Set {i + 1}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="space-y-2 min-w-min">
            {strengthRows.map((row, rowIdx) => (
              <div key={rowIdx}>
                <div className="flex gap-4 items-start min-h-[48px]">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateStrengthRow(rowIdx, "name", e.target.value)}
                    placeholder="Exercise"
                    className="w-32 flex-shrink-0 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 min-h-[44px] text-[var(--color-text)] text-base placeholder-[var(--color-text-faint)] sticky left-0 z-10"
                  />

                  <select
                    value={row.unit}
                    onChange={(e) => updateStrengthRow(rowIdx, "unit", e.target.value)}
                    className="w-24 flex-shrink-0 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 min-h-[44px] text-[var(--color-text)] text-base"
                  >
                    <option value="total">Total weight</option>
                    <option value="per_hand">Per hand</option>
                    <option value="bodyweight">Bodyweight</option>
                  </select>

                  {row.sets.map((set, setIdx) => (
                    <div key={setIdx} className="w-[88px] flex-shrink-0 space-y-1">
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={set.weightLbs ?? ""}
                          onChange={(e) => updateSet(rowIdx, setIdx, "weightLbs", e.target.value ? parseFloat(e.target.value) : null)}
                          inputMode="decimal"
                          placeholder="lb"
                          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1 h-[32px] text-[var(--color-text)] text-sm placeholder-[var(--color-text-faint)]"
                        />
                        <input
                          type="text"
                          value={set.reps ?? ""}
                          onChange={(e) => updateSet(rowIdx, setIdx, "reps", e.target.value ? parseInt(e.target.value) : null)}
                          inputMode="numeric"
                          placeholder="reps"
                          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1 h-[32px] text-[var(--color-text)] text-sm placeholder-[var(--color-text-faint)]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedSet(expandedSet?.row === rowIdx && expandedSet?.set === setIdx ? null : { row: rowIdx, set: setIdx })}
                        className="w-full min-h-[44px] text-[var(--color-text-faint)] hover:text-[var(--color-text)] text-sm font-bold"
                      >
                        ⋯
                      </button>
                    </div>
                  ))}
                </div>

                {/* Expanded options */}
                {expandedSet?.row === rowIdx && expandedSet?.set !== undefined && (
                  <div className="pl-36 pr-2 py-2 space-y-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg mt-1">
                    <div>
                      <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">Set type</p>
                      <div className="flex gap-2">
                        {(["ramp", "working", "abandoned"] as SetType[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => updateSet(rowIdx, expandedSet.set, "setType", st)}
                            className={`px-3 py-1 text-xs font-bold rounded uppercase tracking-widest transition-colors ${
                              row.sets[expandedSet.set].setType === st
                                ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                                : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">RIR</p>
                      <div className="flex gap-2">
                        {[0, 1, 2, 3, 4].map((rir) => (
                          <button
                            key={rir}
                            type="button"
                            onClick={() => toggleRir(rowIdx, expandedSet.set, rir)}
                            className={`px-3 py-1 text-xs font-bold rounded uppercase tracking-widest transition-colors ${
                              row.sets[expandedSet.set].rir === rir
                                ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                                : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                            }`}
                          >
                            {rir === 4 ? "4+" : rir}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={addStrengthRow}
          className="mt-4 px-4 py-2 text-[var(--color-accent)] hover:text-[var(--color-accent)] text-sm font-bold uppercase tracking-widest"
        >
          + Add exercise row
        </button>
      </div>

      {/* Cardio Section */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-4 uppercase tracking-wide">Cardio</h2>

        <div className="space-y-3">
          {cardioRows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-3">
              <select
                value={row.machine}
                onChange={(e) => updateCardioRow(idx, "machine", e.target.value as CardioMachine | "")}
                className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 min-h-[44px] text-[var(--color-text)] text-base"
              >
                <option value="">Machine</option>
                {machineOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={row.minutes ?? ""}
                onChange={(e) => updateCardioRow(idx, "minutes", e.target.value ? parseInt(e.target.value) : null)}
                inputMode="numeric"
                placeholder="Time (min)"
                className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 min-h-[44px] text-[var(--color-text)] text-base placeholder-[var(--color-text-faint)]"
              />

              <input
                type="text"
                value={row.distance ?? ""}
                onChange={(e) => updateCardioRow(idx, "distance", e.target.value ? parseFloat(e.target.value) : null)}
                inputMode="decimal"
                placeholder="Distance (mi)"
                className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 min-h-[44px] text-[var(--color-text)] text-base placeholder-[var(--color-text-faint)]"
              />

              <input
                type="number"
                value={row.heartRate ?? ""}
                onChange={(e) => updateCardioRow(idx, "heartRate", e.target.value ? parseInt(e.target.value) : null)}
                inputMode="numeric"
                placeholder="HR"
                className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 min-h-[44px] text-[var(--color-text)] text-base placeholder-[var(--color-text-faint)]"
              />

              <input
                type="number"
                value={row.calories ?? ""}
                onChange={(e) => updateCardioRow(idx, "calories", e.target.value ? parseInt(e.target.value) : null)}
                inputMode="numeric"
                placeholder="Cal"
                className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 min-h-[44px] text-[var(--color-text)] text-base placeholder-[var(--color-text-faint)]"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addCardioRow}
          className="mt-4 px-4 py-2 text-[var(--color-accent)] hover:text-[var(--color-accent)] text-sm font-bold uppercase tracking-widest"
        >
          + Add cardio row
        </button>
      </div>

      {/* Notes */}
      <div className="mb-8">
        <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes about this workout..."
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text)] text-base placeholder-[var(--color-text-faint)] min-h-[100px]"
        />
      </div>

      {/* Submit Button */}
      <button
        onClick={saveWorkout}
        disabled={saving}
        className="w-full min-h-[52px] bg-[var(--color-accent)] text-[var(--color-bg)] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? "Saving..." : "Save workout"}
      </button>
    </div>
  );
}
