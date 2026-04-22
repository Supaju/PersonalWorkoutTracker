"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES, TEMPLATE_COLORS, type TemplateId } from "@/lib/templates";
import type { AIPlanResponse, PlannedExercise } from "@/lib/types";

export default function PlanSessionPage() {
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<AIPlanResponse | null>(null);
  const [exercises, setExercises] = useState<PlannedExercise[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cycle")
      .then((r) => r.json())
      .then((c) => setTemplate(c.currentTemplate));
  }, []);

  const generate = async () => {
    setGenerating(true);
    setError("");
    setPlan(null);
    try {
      const res = await fetch("/api/sessions/plan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to generate plan."); setGenerating(false); return; }
      setPlan(data.plan);
      setExercises(data.plan.exercises);
    } catch {
      setError("Failed to connect. Check ANTHROPIC_API_KEY in .env.local.");
    }
    setGenerating(false);
  };

  const updateExercise = (idx: number, field: keyof PlannedExercise, value: string | number | null) => {
    setExercises((prev) => prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex)));
  };

  const saveSession = async () => {
    if (!exercises.length) return;
    setSaving(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        template,
        notes: plan?.sessionNotes ?? null,
        exercises: exercises.map((ex, i) => ({ ...ex, orderIndex: i })),
      }),
    });
    const session = await res.json();
    router.push(`/sessions/${session.id}/record`);
  };

  const colorClass = template ? TEMPLATE_COLORS[template] : "bg-slate-100 text-slate-700";
  const tmpl = template ? TEMPLATES[template] : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-2xl font-bold text-slate-900">Plan Session</h2>
        {template && (
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${colorClass}`}>
            {tmpl?.label}
          </span>
        )}
      </div>
      <p className="text-slate-500 text-sm mb-6">Claude will design your workout based on your profile, history, and training science.</p>

      <div className="flex items-center gap-4 mb-8">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Session date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex-1" />
        <button
          onClick={generate}
          disabled={generating || !template}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl transition-colors"
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
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">{error}</div>
      )}

      {plan && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-sm font-medium text-indigo-800 mb-1">Coach Notes</p>
          <p className="text-sm text-indigo-700">{plan.sessionNotes}</p>
        </div>
      )}

      {exercises.length > 0 && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Exercise</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Muscles</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Sets</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Reps</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Start Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exercises.map((ex, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <input
                        value={ex.name}
                        onChange={(e) => updateExercise(i, "name", e.target.value)}
                        className="w-full font-medium text-slate-800 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none"
                      />
                      {ex.aiNotes && (
                        <p className="text-xs text-slate-400 mt-0.5">{ex.aiNotes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{ex.muscleGroups}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={ex.targetSets}
                        onChange={(e) => updateExercise(i, "targetSets", Number(e.target.value))}
                        className="w-12 text-center rounded border border-slate-200 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={ex.targetReps}
                        onChange={(e) => updateExercise(i, "targetReps", e.target.value)}
                        className="w-16 text-center rounded border border-slate-200 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={ex.targetWeight ?? ""}
                          onChange={(e) => updateExercise(i, "targetWeight", e.target.value ? Number(e.target.value) : null)}
                          placeholder="BW"
                          className="w-16 text-center rounded border border-slate-200 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <span className="text-xs text-slate-400">lbs</span>
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
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
            >
              {saving ? "Saving..." : "Save Plan & Go to Gym →"}
            </button>
          </div>
        </>
      )}

      {!plan && !generating && !error && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-16 text-center text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-sm">Hit &ldquo;Generate with AI&rdquo; to build your {tmpl?.label} workout.</p>
          <p className="text-xs mt-1 opacity-70">Claude will design it based on your profile, equipment, and training history.</p>
        </div>
      )}
    </div>
  );
}
