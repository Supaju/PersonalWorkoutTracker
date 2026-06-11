"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES, TEMPLATE_COLORS, type TemplateId } from "@/lib/templates";
import type { WorkoutSession, SessionExercise, SetLog } from "@prisma/client";

type FullSession = WorkoutSession & {
  exercises: (SessionExercise & { sets: SetLog[] })[];
};

type SetEntry = { weightLbs: string; reps: string };

type EditDraft = {
  name: string;
  muscleGroups: string;
  targetSets: string;
  targetReps: string;
  targetWeight: string;
};

const blankDraft = (): EditDraft => ({
  name: "",
  muscleGroups: "",
  targetSets: "3",
  targetReps: "10-12",
  targetWeight: "",
});

function draftFromExercise(ex: SessionExercise): EditDraft {
  return {
    name: ex.name,
    muscleGroups: ex.muscleGroups,
    targetSets: String(ex.targetSets),
    targetReps: ex.targetReps,
    targetWeight: ex.targetWeight ? String(ex.targetWeight) : "",
  };
}

export default function RecordSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<FullSession | null>(null);
  const [setData, setSetData] = useState<Record<string, SetEntry[]>>({});
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(blankDraft());
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState<EditDraft>(blankDraft());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [id]);

  const fetchSession = () =>
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
        setSetData((prev) => {
          const merged: Record<string, SetEntry[]> = { ...initial };
          for (const key of Object.keys(prev)) {
            if (merged[key]) merged[key] = prev[key];
          }
          return merged;
        });
      });

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

  const startEdit = (ex: SessionExercise) => {
    setEditingId(ex.id);
    setEditDraft(draftFromExercise(ex));
    setAddingNew(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editDraft.name.trim()) return;
    setSubmitting(true);
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_exercise",
        exerciseId: editingId,
        ...editDraft,
        targetSets: Number(editDraft.targetSets),
        targetWeight: editDraft.targetWeight ? Number(editDraft.targetWeight) : null,
      }),
    });
    setEditingId(null);
    setSubmitting(false);
    await fetchSession();
  };

  const removeExercise = async (exId: string) => {
    if (!confirm("Remove this exercise from the session?")) return;
    setSubmitting(true);
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_exercise", exerciseId: exId }),
    });
    setEditingId(null);
    setSubmitting(false);
    setSetData((prev) => {
      const copy = { ...prev };
      delete copy[exId];
      return copy;
    });
    await fetchSession();
  };

  const addExercise = async () => {
    if (!newDraft.name.trim()) return;
    setSubmitting(true);
    const orderIndex = (session?.exercises.length ?? 0);
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_exercise",
        ...newDraft,
        targetSets: Number(newDraft.targetSets),
        targetWeight: newDraft.targetWeight ? Number(newDraft.targetWeight) : null,
        orderIndex,
      }),
    });
    setNewDraft(blankDraft());
    setAddingNew(false);
    setSubmitting(false);
    await fetchSession();
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
    await fetch("/api/cycle/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedTemplate: session?.template }),
    });
    router.push(`/sessions/${id}`);
  };

  if (!session) return <div className="text-[var(--color-text-faint)] text-sm">Loading...</div>;

  const label = TEMPLATES[session.template as TemplateId]?.label ?? session.template;
  const colorClass = TEMPLATE_COLORS[session.template as TemplateId] ?? "bg-[var(--color-surface)] text-[var(--color-text-muted)]";

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
}
