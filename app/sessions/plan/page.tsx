"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES, TEMPLATE_COLORS, CYCLE_ORDER, type TemplateId } from "@/lib/templates";
import type { AIPlanResponse, PlannedExercise, Message } from "@/lib/types";
import { PlanReviseDrawer } from "@/components/PlanReviseDrawer";

export default function PlanSessionPage() {
  const router = useRouter();
  const [suggestedTemplate, setSuggestedTemplate] = useState<TemplateId | null>(null);
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<AIPlanResponse | null>(null);
  const [exercises, setExercises] = useState<PlannedExercise[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [planningMessages, setPlanningMessages] = useState<Message[]>([]);
  const [initialPlanJson, setInitialPlanJson] = useState("");

  useEffect(() => {
    fetch("/api/cycle")
      .then((r) => r.json())
      .then((c) => {
        setSuggestedTemplate(c.currentTemplate);
        setTemplate(c.currentTemplate);
      });
  }, []);

  const selectTemplate = (t: TemplateId) => {
    if (t === template) return;
    setTemplate(t);
    setPlan(null);
    setExercises([]);
    setError("");
    setInitialPlanJson("");
    setPlanningMessages([]);
    setDrawerOpen(false);
  };

  const generate = async () => {
    if (!template) return;
    setGenerating(true);
    setError("");
    setPlan(null);
    setInitialPlanJson("");
    setPlanningMessages([]);
    setDrawerOpen(false);
    try {
      const res = await fetch("/api/sessions/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to generate plan."); return; }
      setPlan(data.plan);
      setExercises(data.plan.exercises);
      setInitialPlanJson(JSON.stringify(data.plan));
    } catch {
      setError("Failed to connect. Check ANTHROPIC_API_KEY in .env.local.");
    } finally {
      setGenerating(false);
    }
  };

  const updateExercise = (idx: number, field: keyof PlannedExercise, value: string | number | null) => {
    setExercises((prev) => prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex)));
  };

  const saveSession = async () => {
    if (!exercises.length || !template) return;
    setSaving(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          template,
          notes: plan?.sessionNotes ?? null,
          exercises: exercises.map((ex, i) => ({ ...ex, orderIndex: i })),
          planningChat: planningMessages.length > 0 ? JSON.stringify(planningMessages) : undefined,
        }),
      });
      const session = await res.json();
      if (!res.ok) { setError(session.error || "Failed to save session."); return; }
      router.push(`/sessions/${session.id}/record`);
    } catch {
      setError("Failed to connect.");
    } finally {
      setSaving(false);
    }
  };

  const tmpl = template ? TEMPLATES[template] : null;

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

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest border border-[var(--color-border)] text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Revise with AI
            </button>
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

      {template && (
        <PlanReviseDrawer
          open={drawerOpen}
          template={template}
          currentExercises={exercises}
          initialPlanJson={initialPlanJson}
          onApply={(updated, msgs) => {
            setExercises(updated);
            setPlanningMessages(msgs);
            // drawer stays open so the user can keep refining
          }}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
