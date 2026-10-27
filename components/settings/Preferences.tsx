"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/coach/types";

type PreferenceRow = {
  id: string;
  exerciseName: string;
  kind: "disliked" | "preferred" | "substitute";
  substituteFor: string | null;
  note: string | null;
  createdAt: string;
};

type Kind = "disliked" | "preferred" | "substitute";

const KIND_LABELS: Record<Kind, string> = {
  disliked: "Avoid",
  preferred: "Prefer",
  substitute: "Use instead of",
};

export default function Preferences() {
  const [rows, setRows] = useState<PreferenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [formKind, setFormKind] = useState<Kind>("disliked");
  const [formExercise, setFormExercise] = useState("");
  const [formSubstituteFor, setFormSubstituteFor] = useState("");
  const [formNote, setFormNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api<PreferenceRow[]>("/api/preferences");
      setRows(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formExercise.trim()) {
      setFormError("Exercise name is required");
      return;
    }

    if (formKind === "substitute" && !formSubstituteFor.trim()) {
      setFormError("'Instead of which exercise?' is required when using substitutes");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const body: Record<string, unknown> = {
        exerciseName: formExercise,
        kind: formKind,
      };

      if (formKind === "substitute" && formSubstituteFor.trim()) {
        body.substituteFor = formSubstituteFor;
      }

      if (formNote.trim()) {
        body.note = formNote;
      }

      await api("/api/preferences", body);
      setFormExercise("");
      setFormSubstituteFor("");
      setFormNote("");
      setFormKind("disliked");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await api(`/api/preferences?id=${id}`, undefined, "DELETE");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove";
      setError(msg);
    }
  };

  const grouped: Record<Kind, PreferenceRow[]> = {
    disliked: [],
    preferred: [],
    substitute: [],
  };

  rows.forEach((row) => {
    grouped[row.kind].push(row);
  });

  return (
    <div className="card">
      <h2 className="label mb-6">Exercise preferences</h2>

      {error && (
        <div className="mb-4 rounded-md border border-[var(--color-error)] bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-[var(--color-text-muted)]">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="mb-6 text-[var(--color-text-muted)]">Nothing yet.</p>
      ) : (
        <div className="mb-6 space-y-4">
          {(["disliked", "preferred", "substitute"] as const).map((kind) => {
            const items = grouped[kind];
            if (items.length === 0) return null;

            return (
              <div key={kind}>
                <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">
                  {KIND_LABELS[kind]}
                </h3>
                <ul className="space-y-2">
                  {items.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-start justify-between gap-3 rounded-sm border border-[var(--color-border)] p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="break-words text-sm font-medium text-[var(--color-text)]">
                          {kind === "substitute"
                            ? `Use ${row.exerciseName} instead of ${row.substituteFor}`
                            : row.exerciseName}
                        </p>
                        {row.note && (
                          <p className="mt-1 break-words text-xs text-[var(--color-text-muted)]">
                            {row.note}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemove(row.id)}
                        className="btn-ghost flex h-11 w-11 flex-shrink-0 items-center justify-center rounded text-lg font-bold"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-3">
        {formError && (
          <div className="rounded-md border border-[var(--color-error)] bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
            {formError}
          </div>
        )}

        <div>
          <select
            value={formKind}
            onChange={(e) => setFormKind(e.target.value as Kind)}
            className="input w-full"
          >
            <option value="disliked">Avoid</option>
            <option value="preferred">Prefer</option>
            <option value="substitute">Use instead of</option>
          </select>
        </div>

        <input
          type="text"
          value={formExercise}
          onChange={(e) => setFormExercise(e.target.value)}
          placeholder="Exercise name"
          className="input w-full"
        />

        {formKind === "substitute" && (
          <input
            type="text"
            value={formSubstituteFor}
            onChange={(e) => setFormSubstituteFor(e.target.value)}
            placeholder="Instead of which exercise?"
            className="input w-full"
          />
        )}

        <input
          type="text"
          value={formNote}
          onChange={(e) => setFormNote(e.target.value)}
          placeholder="Optional note"
          className="input w-full"
        />

        <button
          type="submit"
          disabled={submitting}
          className="btn-accent w-full"
        >
          {submitting ? "Adding..." : "Add"}
        </button>
      </form>
    </div>
  );
}
