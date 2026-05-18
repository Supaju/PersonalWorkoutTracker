"use client";

import { useState, useEffect, useRef } from "react";
import type { FoodItem } from "@prisma/client";

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
type Slot = (typeof SLOTS)[number];
const SLOT_LABELS: Record<Slot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

interface NutritionEntry {
  id: string;
  date: string;
  slot: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  date: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface DayTargets {
  calories: number;
  protein: number;
}

export default function MealsPage() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [targets, setTargets] = useState<DayTargets>({ calories: 2000, protein: 180 });
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    description: "",
    slot: "lunch" as Slot,
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [addingManual, setAddingManual] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    slot: "lunch" as Slot,
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  const [showLibrary, setShowLibrary] = useState(false);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [foodForm, setFoodForm] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    serving: "",
  });
  const [addingFood, setAddingFood] = useState(false);
  const [showFoodForm, setShowFoodForm] = useState(false);

  const loadData = async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nutrition?date=${d}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
      setChat(data.chat ?? []);
      if (data.targets) setTargets(data.targets);
    } finally {
      setLoading(false);
    }
  };

  const loadFoods = () =>
    fetch("/api/meals/foods")
      .then((r) => r.json())
      .then(setFoods);

  useEffect(() => {
    loadData(date);
  }, [date]);

  useEffect(() => {
    if (showLibrary) loadFoods();
  }, [showLibrary]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, sending]);

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setMessage("");

    const tempId = "temp-" + Date.now();
    setChat((prev) => [
      ...prev,
      { id: tempId, date, role: "user", content: text, createdAt: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/nutrition/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChat((prev) => [
          ...prev,
          {
            id: "err-" + Date.now(),
            date,
            role: "assistant",
            content: "Error: " + (data.error || "Failed to get response."),
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }
      await loadData(date);
    } catch {
      setChat((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          date,
          role: "assistant",
          content: "Failed to connect. Check your connection and try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const deleteEntry = async (id: string) => {
    await fetch(`/api/nutrition/entries/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const startEdit = (entry: NutritionEntry) => {
    setEditingId(entry.id);
    setEditForm({
      description: entry.description,
      slot: entry.slot as Slot,
      calories: String(Math.round(entry.calories)),
      protein: String(Math.round(entry.protein)),
      carbs: String(Math.round(entry.carbs)),
      fat: String(Math.round(entry.fat)),
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/nutrition/entries/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: editForm.description,
        slot: editForm.slot,
        calories: parseFloat(editForm.calories) || 0,
        protein: parseFloat(editForm.protein) || 0,
        carbs: parseFloat(editForm.carbs) || 0,
        fat: parseFloat(editForm.fat) || 0,
      }),
    });
    const updated = await res.json();
    setEntries((prev) => prev.map((e) => (e.id === editingId ? updated : e)));
    setEditingId(null);
  };

  const addManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingManual(true);
    try {
      const res = await fetch("/api/nutrition/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          slot: manualForm.slot,
          description: manualForm.description,
          calories: parseFloat(manualForm.calories) || 0,
          protein: parseFloat(manualForm.protein) || 0,
          carbs: parseFloat(manualForm.carbs) || 0,
          fat: parseFloat(manualForm.fat) || 0,
        }),
      });
      const entry = await res.json();
      setEntries((prev) => [...prev, entry]);
      setManualForm({ description: "", slot: "lunch", calories: "", protein: "", carbs: "", fat: "" });
      setShowManual(false);
    } finally {
      setAddingManual(false);
    }
  };

  const handleAddFood = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingFood(true);
    await fetch("/api/meals/foods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(foodForm),
    });
    setFoodForm({ name: "", calories: "", protein: "", carbs: "", fat: "", serving: "" });
    setShowFoodForm(false);
    await loadFoods();
    setAddingFood(false);
  };

  const handleDeleteFood = async (id: string) => {
    await fetch(`/api/meals/foods?id=${id}`, { method: "DELETE" });
    setFoods((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">
        Nutrition
      </h2>
      <p className="text-[var(--color-text-faint)] text-sm mb-4">
        Tell Claude what you ate — it logs it, tracks your macros, and advises for the rest of the day.
      </p>

      {/* Date picker */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Left: Food Log */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <p className="text-[var(--color-text-faint)] text-sm">Loading...</p>
          ) : (
            <>
              {SLOTS.map((slot) => {
                const slotEntries = entries.filter((e) => e.slot === slot);
                return (
                  <div
                    key={slot}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4"
                  >
                    <h4 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-3">
                      {SLOT_LABELS[slot]}
                    </h4>
                    {slotEntries.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-faint)] italic">Nothing logged</p>
                    ) : (
                      <ul className="space-y-2">
                        {slotEntries.map((entry) =>
                          editingId === entry.id ? (
                            <li
                              key={entry.id}
                              className="space-y-2 border border-[var(--color-border)] p-3 bg-[var(--color-bg)]"
                            >
                              <input
                                value={editForm.description}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, description: e.target.value })
                                }
                                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                              />
                              <select
                                value={editForm.slot}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, slot: e.target.value as Slot })
                                }
                                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                              >
                                {SLOTS.map((s) => (
                                  <option key={s} value={s}>
                                    {SLOT_LABELS[s]}
                                  </option>
                                ))}
                              </select>
                              <div className="grid grid-cols-4 gap-2">
                                {(["calories", "protein", "carbs", "fat"] as const).map((field) => (
                                  <div key={field}>
                                    <label className="block text-xs text-[var(--color-text-faint)] mb-0.5">
                                      {field === "calories"
                                        ? "kcal"
                                        : field.charAt(0).toUpperCase() + field.slice(1) + " g"}
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.1}
                                      value={editForm[field]}
                                      onChange={(e) =>
                                        setEditForm({ ...editForm, [field]: e.target.value })
                                      }
                                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button onClick={saveEdit} className="btn-accent text-xs">
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </li>
                          ) : (
                            <li key={entry.id} className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm text-[var(--color-text)]">{entry.description}</p>
                                <p className="text-xs text-[var(--color-text-faint)]">
                                  {Math.round(entry.calories)} kcal · P:{" "}
                                  {Math.round(entry.protein)}g · C: {Math.round(entry.carbs)}g · F:{" "}
                                  {Math.round(entry.fat)}g
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => startEdit(entry)}
                                  className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors p-0.5"
                                  aria-label="Edit"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => deleteEntry(entry.id)}
                                  className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors p-0.5"
                                  aria-label="Delete"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}

              {/* Manual add */}
              {showManual ? (
                <form
                  onSubmit={addManual}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 space-y-2"
                >
                  <p className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-2">
                    Add Manually
                  </p>
                  <input
                    required
                    placeholder="Description (e.g. 2 eggs, 200g chicken breast)"
                    value={manualForm.description}
                    onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                  <select
                    value={manualForm.slot}
                    onChange={(e) => setManualForm({ ...manualForm, slot: e.target.value as Slot })}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    {SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {SLOT_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    {(["calories", "protein", "carbs", "fat"] as const).map((field) => (
                      <input
                        key={field}
                        required
                        type="number"
                        min={0}
                        step={0.1}
                        placeholder={
                          field === "calories"
                            ? "Calories (kcal)"
                            : field.charAt(0).toUpperCase() + field.slice(1) + " (g)"
                        }
                        value={manualForm[field]}
                        onChange={(e) => setManualForm({ ...manualForm, [field]: e.target.value })}
                        className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={addingManual} className="btn-accent text-xs">
                      {addingManual ? "Adding..." : "Add Entry"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManual(false)}
                      className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowManual(true)}
                  className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium uppercase tracking-wider self-start"
                >
                  + Add manually
                </button>
              )}

              {/* Daily totals */}
              <div className="bg-[var(--color-bg)] border border-[var(--color-border)] p-4">
                <h4 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-3">
                  Daily Totals
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(
                    [
                      { label: "Calories", value: Math.round(totals.calories), unit: "kcal", color: totals.calories > targets.calories ? "text-[#dc2626]" : "text-[#86efac]", target: targets.calories },
                      { label: "Protein", value: Math.round(totals.protein), unit: "g", color: totals.protein >= targets.protein ? "text-[#86efac]" : "text-[#fbbf24]", target: targets.protein },
                      { label: "Carbs", value: Math.round(totals.carbs), unit: "g", color: "text-[#fdba74]", target: null },
                      { label: "Fat", value: Math.round(totals.fat), unit: "g", color: "text-[#93c5fd]", target: null },
                    ] as const
                  ).map(({ label, value, unit, color, target }) => (
                    <div key={label}>
                      <p className={`text-lg font-bold ${color}`}>
                        {value}
                        <span className="text-xs font-normal ml-0.5">{unit}</span>
                      </p>
                      <p className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider">
                        {label}
                      </p>
                      {target !== null && (
                        <p className="text-xs text-[var(--color-text-faint)]">
                          / {target}{unit}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: AI Chat */}
        <div className="flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[500px] max-h-[700px]">
            {chat.length === 0 && !loading && (
              <p className="text-xs text-[var(--color-text-faint)] italic">
                Tell Claude what you ate and it will log it, track your macros, and guide the rest
                of your day. Or ask for meal suggestions.
              </p>
            )}
            {chat.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]"
                      : "bg-[#110a1a] border border-[#2a1a3a] text-[#c4b5fd]"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-[#110a1a] border border-[#2a1a3a] px-3 py-2">
                  <span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] animate-pulse align-middle" />
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
          <div className="border-t border-[var(--color-border)] p-3 flex gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="I had a large chicken burrito for lunch..."
              rows={2}
              className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !message.trim()}
              className="btn-accent text-xs self-end"
            >
              {sending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Food Library (collapsible) */}
      <div className="border-t border-[var(--color-border)] pt-6">
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-4 uppercase tracking-widest"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showLibrary ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          Manage Food Library
        </button>

        {showLibrary && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--color-text-faint)]">
                Foods Claude references when suggesting meals. Add anything you regularly eat.
              </p>
              <button
                onClick={() => setShowFoodForm(!showFoodForm)}
                className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium uppercase tracking-wider"
              >
                {showFoodForm ? "Cancel" : "+ Add food"}
              </button>
            </div>

            {showFoodForm && (
              <form
                onSubmit={handleAddFood}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 space-y-2"
              >
                <input
                  required
                  placeholder="Food name"
                  value={foodForm.name}
                  onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                <input
                  placeholder="Serving size (e.g. 100g)"
                  value={foodForm.serving}
                  onChange={(e) => setFoodForm({ ...foodForm, serving: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                <div className="grid grid-cols-2 gap-2">
                  {(["calories", "protein", "carbs", "fat"] as const).map((field) => (
                    <input
                      key={field}
                      required
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder={
                        field.charAt(0).toUpperCase() +
                        field.slice(1) +
                        (field === "calories" ? " (kcal)" : " (g)")
                      }
                      value={foodForm[field]}
                      onChange={(e) => setFoodForm({ ...foodForm, [field]: e.target.value })}
                      className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={addingFood}
                  className="btn-accent w-full justify-center text-xs"
                >
                  {addingFood ? "Adding..." : "Add Food"}
                </button>
              </form>
            )}

            <div className="space-y-2">
              {foods.length === 0 && (
                <p className="text-[var(--color-text-faint)] text-sm">No foods yet.</p>
              )}
              {foods.map((food) => (
                <div
                  key={food.id}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3 flex items-start justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{food.name}</p>
                    {food.serving && (
                      <p className="text-xs text-[var(--color-text-faint)]">{food.serving}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-[var(--color-text-faint)]">
                      <span>{food.calories} kcal</span>
                      <span>P: {food.protein}g</span>
                      <span>C: {food.carbs}g</span>
                      <span>F: {food.fat}g</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteFood(food.id)}
                    className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
