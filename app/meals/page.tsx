"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { FoodItem } from "@prisma/client";
import type { MealEntry, MealSlot } from "@/lib/types";

const MEAL_SLOTS: { slot: MealSlot; label: string }[] = [
  { slot: "breakfast", label: "Breakfast" },
  { slot: "lunch", label: "Lunch" },
  { slot: "dinner", label: "Dinner" },
  { slot: "snack", label: "Snack" },
];

const today = new Date().toISOString().split("T")[0];

export default function MealsPage() {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [foodForm, setFoodForm] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", serving: "" });
  const [addingFood, setAddingFood] = useState(false);
  const [showFoodForm, setShowFoodForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // AI meal plan
  const [generating, setGenerating] = useState(false);
  const [planNotes, setPlanNotes] = useState("");
  const [planError, setPlanError] = useState("");

  // Deviation analyzer
  const [deviationText, setDeviationText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [showDeviation, setShowDeviation] = useState(false);
  const analysisRef = useRef<HTMLDivElement>(null);

  const loadFoods = useCallback(() =>
    fetch("/api/meals/foods").then((r) => r.json()).then(setFoods), []);

  const loadPlan = useCallback(() =>
    fetch(`/api/meals/plan?date=${today}`)
      .then((r) => r.json())
      .then((plan) => { if (plan?.meals) setEntries(JSON.parse(plan.meals)); })
      .catch(() => {}), []);

  useEffect(() => { loadFoods(); loadPlan(); }, [loadFoods, loadPlan]);

  useEffect(() => {
    if (analysisRef.current) analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
  }, [analysisResult]);

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
    setEntries((prev) => prev.filter((e) => e.foodItemId !== id));
  };

  const addEntry = (slot: MealSlot, foodItemId: string) => {
    setEntries((prev) => [...prev, { slot, foodItemId, quantity: 1 }]);
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const savePlan = async () => {
    setSaving(true);
    await fetch("/api/meals/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, meals: entries }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const generateAIPlan = async () => {
    setGenerating(true);
    setPlanError("");
    setPlanNotes("");
    try {
      const res = await fetch("/api/meals/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
      const data = await res.json();
      if (!res.ok) { setPlanError(data.error || "Failed to generate plan."); setGenerating(false); return; }

      setPlanNotes(data.planNotes ?? "");

      // Build entries from AI response
      const newEntries: MealEntry[] = [];
      for (const meal of data.meals ?? []) {
        for (const item of meal.items ?? []) {
          if (foods.find((f) => f.id === item.foodItemId)) {
            newEntries.push({ slot: meal.slot as MealSlot, foodItemId: item.foodItemId, quantity: item.quantity ?? 1 });
          }
        }
      }
      setEntries(newEntries);
    } catch {
      setPlanError("Failed to connect. Check ANTHROPIC_API_KEY.");
    }
    setGenerating(false);
  };

  const analyzeDeviation = async () => {
    if (!deviationText.trim()) return;
    setAnalyzing(true);
    setAnalysisResult("");
    try {
      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: deviationText, date: today }),
      });
      if (!res.ok) { setAnalysisResult("Error: Could not analyze. Check ANTHROPIC_API_KEY."); setAnalyzing(false); return; }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnalysisResult((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch {
      setAnalysisResult("Failed to connect.");
    }
    setAnalyzing(false);
  };

  const totals = entries.reduce(
    (acc, entry) => {
      const food = foods.find((f) => f.id === entry.foodItemId);
      if (!food) return acc;
      return {
        calories: acc.calories + food.calories * entry.quantity,
        protein: acc.protein + food.protein * entry.quantity,
        carbs: acc.carbs + food.carbs * entry.quantity,
        fat: acc.fat + food.fat * entry.quantity,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">Meals</h2>
      <p className="text-[var(--color-text-faint)] text-sm mb-8">Build your food library, generate AI meal plans, and analyze anything you eat.</p>

      <div className="grid grid-cols-2 gap-8">
        {/* ── Food Library ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--color-text)] uppercase tracking-widest text-xs">Food Library</h3>
            <button
              onClick={() => setShowFoodForm(!showFoodForm)}
              className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium uppercase tracking-wider"
            >
              {showFoodForm ? "Cancel" : "+ Add food"}
            </button>
          </div>

          {showFoodForm && (
            <form onSubmit={handleAddFood} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 mb-4 space-y-2">
              <input required placeholder="Food name" value={foodForm.name}
                onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]" />
              <input placeholder="Serving size (e.g. 100g)" value={foodForm.serving}
                onChange={(e) => setFoodForm({ ...foodForm, serving: e.target.value })}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]" />
              <div className="grid grid-cols-2 gap-2">
                {(["calories", "protein", "carbs", "fat"] as const).map((field) => (
                  <input key={field} required type="number" min={0} step={0.1}
                    placeholder={field.charAt(0).toUpperCase() + field.slice(1) + (field === "calories" ? " (kcal)" : " (g)")}
                    value={foodForm[field]}
                    onChange={(e) => setFoodForm({ ...foodForm, [field]: e.target.value })}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]" />
                ))}
              </div>
              <button type="submit" disabled={addingFood}
                className="btn-accent w-full justify-center text-xs">
                {addingFood ? "Adding..." : "Add Food"}
              </button>
            </form>
          )}

          <div className="space-y-2">
            {foods.length === 0 && <p className="text-[var(--color-text-faint)] text-sm">No foods yet.</p>}
            {foods.map((food) => (
              <div key={food.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{food.name}</p>
                    {food.serving && <p className="text-xs text-[var(--color-text-faint)]">{food.serving}</p>}
                  </div>
                  <button onClick={() => handleDeleteFood(food.id)} className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-[var(--color-text-faint)]">
                  <span>{food.calories} kcal</span>
                  <span>P: {food.protein}g</span>
                  <span>C: {food.carbs}g</span>
                  <span>F: {food.fat}g</span>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {MEAL_SLOTS.map(({ slot, label }) => (
                    <button key={slot} onClick={() => addEntry(slot, food.id)}
                      className="text-xs px-2 py-0.5 border border-[var(--color-border)] text-[var(--color-text-faint)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
                      + {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Daily Meal Plan ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--color-text)] uppercase tracking-widest text-xs">Today&apos;s Plan</h3>
            <span className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider">{today}</span>
          </div>

          {/* AI generate button */}
          <button
            onClick={generateAIPlan}
            disabled={generating}
            className="btn-accent w-full justify-center mb-4 text-xs"
          >
            {generating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating plan...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate AI Meal Plan
              </>
            )}
          </button>

          {planError && (
            <div className="mb-4 bg-[#1a0505] border border-[#3a1010] text-[#f87171] text-sm p-3">{planError}</div>
          )}

          {planNotes && (
            <div className="mb-4 bg-[#110a1a] border border-[#2a1a3a] p-3">
              <p className="text-xs font-bold text-[#c4b5fd] mb-1 uppercase tracking-widest">Nutrition Notes</p>
              <p className="text-sm text-[#c4b5fd]">{planNotes}</p>
            </div>
          )}

          <div className="space-y-3 mb-4">
            {MEAL_SLOTS.map(({ slot, label }) => {
              const slotEntries = entries.map((e, i) => ({ ...e, idx: i })).filter((e) => e.slot === slot);
              return (
                <div key={slot} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
                  <h4 className="text-xs font-bold text-[var(--color-text-faint)] mb-2 uppercase tracking-widest">{label}</h4>
                  {slotEntries.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-faint)]">Nothing added</p>
                  ) : (
                    <ul className="space-y-1">
                      {slotEntries.map(({ idx, foodItemId, quantity }) => {
                        const food = foods.find((f) => f.id === foodItemId);
                        if (!food) return null;
                        return (
                          <li key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-[var(--color-text-muted)]">
                              {quantity > 1 && <span className="text-[var(--color-text-faint)] text-xs mr-1">{quantity}×</span>}
                              {food.name}
                            </span>
                            <div className="flex items-center gap-3 text-xs text-[var(--color-text-faint)]">
                              <span>{Math.round(food.calories * quantity)} kcal</span>
                              <button onClick={() => removeEntry(idx)} className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)]">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {entries.length > 0 && (
            <div className="bg-[var(--color-bg)] border border-[var(--color-border)] p-4 mb-4">
              <h4 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-2">Daily Totals</h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Calories", value: Math.round(totals.calories), unit: "kcal", color: "text-[#dc2626]" },
                  { label: "Protein", value: Math.round(totals.protein), unit: "g", color: "text-[#86efac]" },
                  { label: "Carbs", value: Math.round(totals.carbs), unit: "g", color: "text-[#fdba74]" },
                  { label: "Fat", value: Math.round(totals.fat), unit: "g", color: "text-[#f87171]" },
                ].map(({ label, value, unit, color }) => (
                  <div key={label}>
                    <p className={`text-lg font-bold ${color}`}>{value}<span className="text-xs font-normal ml-0.5">{unit}</span></p>
                    <p className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={savePlan} disabled={saving || entries.length === 0}
            className="btn-accent w-full justify-center mb-6 text-xs">
            {saving ? "Saving..." : saved ? "Saved!" : "Save Meal Plan"}
          </button>

          {/* ── Deviation Analyzer ── */}
          <div className="border-t border-[var(--color-border)] pt-6">
            <button
              onClick={() => { setShowDeviation(!showDeviation); setAnalysisResult(""); }}
              className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-3 uppercase tracking-widest"
            >
              <svg className={`w-4 h-4 transition-transform ${showDeviation ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Analyze Something I Ate
            </button>

            {showDeviation && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--color-text-faint)]">Describe anything you ate or plan to eat — on or off plan. Claude will break down the nutrition and help you course-correct.</p>
                <textarea
                  value={deviationText}
                  onChange={(e) => setDeviationText(e.target.value)}
                  placeholder={`e.g. "I had a Big Mac, large fries, and a Coke"`}
                  rows={3}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                />
                <button
                  onClick={analyzeDeviation}
                  disabled={analyzing || !deviationText.trim()}
                  className="btn-accent w-full justify-center text-xs"
                >
                  {analyzing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing...
                    </>
                  ) : "Analyze Nutrition"}
                </button>

                {analysisResult && (
                  <div
                    ref={analysisRef}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)] whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto"
                  >
                    {analysisResult}
                    {analyzing && <span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] ml-0.5 animate-pulse align-middle" />}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
