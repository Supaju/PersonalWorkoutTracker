"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES, TEMPLATE_COLORS, type TemplateId } from "@/lib/templates";
import type { WorkoutSession, SessionExercise, SetLog } from "@prisma/client";

type FullSession = WorkoutSession & {
  exercises: (SessionExercise & { sets: SetLog[] })[];
};

type SetEntry = { weightLbs: string; reps: string };

export default function RecordSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<FullSession | null>(null);
  const [setData, setSetData] = useState<Record<string, SetEntry[]>>({});
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then((r) => r.json())
      .then((s: FullSession) => {
        setSession(s);
        setNotes(s.notes ?? "");
        const initial: Record<string, SetEntry[]> = {};
        for (const ex of s.exercises) {
          initial[ex.id] =
            ex.sets.length > 0
              ? ex.sets.map((st) => ({ weightLbs: String(st.weightLbs), reps: String(st.reps) }))
              : Array.from({ length: ex.targetSets }, () => ({
                  weightLbs: ex.targetWeight ? String(ex.targetWeight) : "",
                  reps: ex.targetReps.includes("-") ? ex.targetReps.split("-")[1] : ex.targetReps,
                }));
        }
        setSetData(initial);
      });
  }, [id]);

  const updateSet = (exId: string, setIdx: number, field: "weightLbs" | "reps", val: string) => {
    setSetData((prev) => {
      const copy = [...(prev[exId] ?? [])];
      copy[setIdx] = { ...copy[setIdx], [field]: val };
      return { ...prev, [exId]: copy };
    });
  };

  const addSet = (exId: string) => {
    setSetData((prev) => ({
      ...prev,
      [exId]: [...(prev[exId] ?? []), { weightLbs: "", reps: "" }],
    }));
  };

  const removeSet = (exId: string, setIdx: number) => {
    setSetData((prev) => ({
      ...prev,
      [exId]: (prev[exId] ?? []).filter((_, i) => i !== setIdx),
    }));
  };

  const saveSets = async (exId: string) => {
    const sets = (setData[exId] ?? [])
      .filter((s) => s.weightLbs !== "" && s.reps !== "")
      .map((s, i) => ({ setNumber: i + 1, weightLbs: Number(s.weightLbs), reps: Number(s.reps) }));
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_sets", exerciseId: exId, sets }),
    });
    setSaved((prev) => ({ ...prev, [exId]: true }));
    setTimeout(() => setSaved((prev) => ({ ...prev, [exId]: false })), 2000);
  };

  const finishSession = async () => {
    setSaving(true);
    for (const ex of session?.exercises ?? []) {
      await saveSets(ex.id);
    }
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_recorded", durationMin: duration ? Number(duration) : null, notes }),
    });
    await fetch("/api/cycle/advance", { method: "POST" });
    router.push(`/sessions/${id}`);
  };

  if (!session) return <div className="text-slate-400 text-sm">Loading...</div>;

  const label = TEMPLATES[session.template as TemplateId]?.label ?? session.template;
  const colorClass = TEMPLATE_COLORS[session.template as TemplateId] ?? "bg-slate-100 text-slate-700";

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-2xl font-bold text-slate-900">Record Session</h2>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${colorClass}`}>{label}</span>
        <span className="text-sm text-slate-400">{session.date}</span>
      </div>
      <p className="text-slate-500 text-sm mb-6">Log your actual sets and reps. Fill in as you go, or all at once after the session.</p>

      {session.notes && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-indigo-700 mb-1">Coach Notes</p>
          <p className="text-sm text-indigo-800">{session.notes}</p>
        </div>
      )}

      <div className="space-y-6 mb-8">
        {session.exercises.map((ex) => {
          const sets = setData[ex.id] ?? [];
          return (
            <div key={ex.id} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="font-semibold text-slate-900">{ex.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Target: {ex.targetSets} × {ex.targetReps}{ex.targetWeight ? ` @ ${ex.targetWeight} lbs` : ""}
                  </p>
                </div>
                <button
                  onClick={() => saveSets(ex.id)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    saved[ex.id]
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {saved[ex.id] ? "Saved ✓" : "Save Sets"}
                </button>
              </div>

              {ex.aiNotes && <p className="text-xs text-slate-400 italic mb-3">{ex.aiNotes}</p>}

              <div className="mt-3 space-y-2">
                {sets.map((s, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-10 shrink-0">Set {si + 1}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="0"
                        value={s.weightLbs}
                        onChange={(e) => updateSet(ex.id, si, "weightLbs", e.target.value)}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <span className="text-xs text-slate-400">lbs</span>
                    </div>
                    <span className="text-slate-300">×</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="0"
                        value={s.reps}
                        onChange={(e) => updateSet(ex.id, si, "reps", e.target.value)}
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <span className="text-xs text-slate-400">reps</span>
                    </div>
                    <button
                      onClick={() => removeSet(ex.id, si)}
                      className="text-slate-300 hover:text-red-400 transition-colors ml-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addSet(ex.id)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
                >
                  + Add set
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 space-y-4">
        <h3 className="font-semibold text-slate-800">Wrap Up</h3>
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Session duration (min)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Session notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel? Any issues?"
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={() => router.push("/sessions")}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to sessions
        </button>
        <button
          onClick={finishSession}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
        >
          {saving ? "Finishing..." : "Finish & Advance Cycle →"}
        </button>
      </div>
    </div>
  );
}
