"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/coach/types";

type ConsiderationRow = {
  id: string;
  category: "body_size" | "injury" | "medical" | "equipment" | "other";
  text: string;
  createdAt: string;
};

type Category = "body_size" | "injury" | "medical" | "equipment" | "other";

export default function Considerations() {
  const [rows, setRows] = useState<ConsiderationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [formCategory, setFormCategory] = useState<Category>("injury");
  const [formText, setFormText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api<ConsiderationRow[]>("/api/considerations");
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
    if (!formText.trim()) {
      setFormError("Text is required");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      await api("/api/considerations", { category: formCategory, text: formText });
      setFormText("");
      setFormCategory("injury");
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
      await api(`/api/considerations?id=${id}`, undefined, "DELETE");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove";
      setError(msg);
    }
  };

  const categoryLabel = (cat: string) => cat.replace(/_/g, " ");

  return (
    <div className="card">
      <h2 className="label mb-6">Things your coach should know</h2>

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
        <ul className="mb-6 space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-sm border border-[var(--color-border)] p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="mb-1 inline-block rounded border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-text-muted)]">
                  {categoryLabel(row.category)}
                </div>
                <p className="break-words text-sm text-[var(--color-text)]">{row.text}</p>
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
      )}

      <form onSubmit={handleAdd} className="space-y-3">
        {formError && (
          <div className="rounded-md border border-[var(--color-error)] bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
            {formError}
          </div>
        )}

        <div>
          <select
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value as Category)}
            className="input w-full"
          >
            <option value="injury">Injury</option>
            <option value="body_size">Body size</option>
            <option value="medical">Medical</option>
            <option value="equipment">Equipment</option>
            <option value="other">Other</option>
          </select>
        </div>

        <input
          type="text"
          value={formText}
          onChange={(e) => setFormText(e.target.value)}
          placeholder="e.g. Left shoulder impingement — avoid overhead pressing"
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
