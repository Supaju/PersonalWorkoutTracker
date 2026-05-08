"use client";

import { useState, useEffect } from "react";
import { EQUIPMENT_CATEGORY_LABELS, type EquipmentCategory } from "@/lib/types";
import type { Equipment } from "@prisma/client";

const CATEGORIES = Object.entries(EQUIPMENT_CATEGORY_LABELS) as [EquipmentCategory, string][];

const CATEGORY_COLORS: Record<EquipmentCategory, string> = {
  machine: "bg-[#0a0f1a] text-[#93c5fd]",
  free_weight: "bg-[#1a0f00] text-[#fdba74]",
  bodyweight: "bg-[#0a1a0a] text-[#86efac]",
  cardio: "bg-[#1a0a0a] text-[#f87171]",
};

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [form, setForm] = useState({ name: "", category: "machine" as EquipmentCategory });
  const [adding, setAdding] = useState(false);

  const load = () =>
    fetch("/api/equipment")
      .then((r) => r.json())
      .then(setItems);

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", category: "machine" });
    await load();
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/equipment?id=${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const grouped = CATEGORIES.reduce((acc, [cat]) => {
    acc[cat] = items.filter((i) => i.category === cat);
    return acc;
  }, {} as Record<EquipmentCategory, Equipment[]>);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Equipment</h2>
      <p className="text-slate-500 text-sm mb-8">Add what you have access to — Claude uses this to tailor exercise recommendations.</p>

      <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">Equipment name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Barbell, Treadmill, Pull-up bar"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as EquipmentCategory })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={adding}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {adding ? "Adding..." : "Add Equipment"}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-slate-400 text-sm">No equipment added yet.</p>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map(([cat, label]) =>
            grouped[cat].length > 0 ? (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</h3>
                <div className="flex flex-wrap gap-2">
                  {grouped[cat].map((item) => (
                    <span
                      key={item.id}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${CATEGORY_COLORS[cat as EquipmentCategory]}`}
                    >
                      {item.name}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="opacity-60 hover:opacity-100 transition-opacity ml-1"
                        aria-label={`Remove ${item.name}`}
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
