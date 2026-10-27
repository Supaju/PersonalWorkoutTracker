"use client";

import { useState, useEffect } from "react";
import { EQUIPMENT_CATEGORY_LABELS, type EquipmentCategory } from "@/lib/types";
import { api } from "@/components/coach/types";
import type { Equipment } from "@prisma/client";

const CATEGORIES = Object.entries(EQUIPMENT_CATEGORY_LABELS) as [EquipmentCategory, string][];

export default function EquipmentEditor() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [form, setForm] = useState({ name: "", category: "machine_cable" as EquipmentCategory });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await api<Equipment[]>("/api/equipment");
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load equipment");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await api("/api/equipment", form);
      setForm({ name: "", category: "machine_cable" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add equipment");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await api(`/api/equipment?id=${id}`, undefined, "DELETE");
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete equipment");
    }
  };

  const grouped = CATEGORIES.reduce((acc, [cat]) => {
    acc[cat] = items.filter((i) => i.category === cat);
    return acc;
  }, {} as Record<EquipmentCategory, Equipment[]>);

  return (
    <div className="card">
      <label className="label">Equipment</label>

      <form onSubmit={handleAdd} className="mb-8 flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="label">Equipment name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Barbell, Treadmill, Pull-up bar"
            className="input"
          />
        </div>
        <div>
          <label className="label">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as EquipmentCategory })}
            className="input h-[44px]"
          >
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={adding}
          className="btn-accent text-xs"
        >
          {adding ? "Adding..." : "Add Equipment"}
        </button>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-[var(--color-warn)] bg-opacity-10 border border-[var(--color-warn)] text-[var(--color-warn)] text-sm rounded">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-[var(--color-text-faint)] text-sm">No equipment added yet.</p>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map(([cat, label]) =>
            grouped[cat].length > 0 ? (
              <div key={cat}>
                <h3 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-2">{label}</h3>
                <div className="flex flex-wrap gap-2">
                  {grouped[cat].map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)]"
                    >
                      {item.name}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="opacity-60 hover:opacity-100 transition-opacity ml-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                        aria-label={`Remove ${item.name}`}
                        type="button"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
