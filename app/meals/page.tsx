"use client";

import { useState, useEffect, useCallback } from "react";
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

  const loadFoods = useCallback(() =>
    fetch("/api/meals/foods").then((r) => r.json()).then(setFoods), []);

  const loadPlan = useCallback(() =>
    fetch(`/api/meals/plan?date=${today}`)
      .then((r) => r.json())
      .then((plan) => {
        if (plan?.meals) setEntries(JSON.parse(plan.meals));
      })
      .catch(() => {}), []);

  useEffect(() => {
    loadFoods();
    loadPlan();
  }, [loadFoods, loadPlan]);

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
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Meals</h2>
      <p className="text-slate-500 text-sm mb-8">Manage your food library and plan today&apos;s meals. Claude reviews your nutrition against your goals.</p>

      <div className="grid grid-cols-2 gap-8">
        {/* Food Library */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Food Library</h3>
            <button
              onClick={() => setShowFoodForm(!showFoodForm)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {showFoodForm ? "Cancel" : "+ Add food"}
            </button>
          </div>

          {showFoodForm && (
            <form onSubmit={handleAddFood} className="bg-white rounded-xl border border-slate-200 p-4 mb-4 space-y-2">
              <input
                required
                placeholder="Food name"
                value={foodForm.name}
                onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                placeholder="Serving size (e.g. 100g, 1 cup)"
                value={foodForm.serving}
                onChange={(e) => setFoodForm({ ...foodForm, serving: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="grid grid-cols-2 gap-2">
                {(["calories", "protein", "carbs", "fat"] as const).map((field) => (
                  <input
                    key={field}
                    required
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder={field.charAt(0).toUpperCase() + field.slice(1) + (field === "calories" ? " (kcal)" : " (g)")}
                    value={foodForm[field]}
                    onChange={(e) => setFoodForm({ ...foodForm, [field]: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={addingFood}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {addingFood ? "Adding..." : "Add Food"}
              </button>
            </form>
          )}

          <div className="space-y-2">
            {foods.length === 0 && <p className="text-slate-400 text-sm">No foods yet.</p>}
            {foods.map((food) => (
              <div key={food.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{food.name}</p>
                    {food.serving && <p className="text-xs text-slate-400">{food.serving}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteFood(food.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-slate-500">
                  <span>{food.calories} kcal</span>
                  <span>P: {food.protein}g</span>
                  <span>C: {food.carbs}g</span>
                  <span>F: {food.fat}g</span>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {MEAL_SLOTS.map(({ slot, label }) => (
                    <button
                      key={slot}
                      onClick={() => addEntry(slot, food.id)}
                      className="text-xs px-2 py-0.5 rounded-md border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                    >
                      + {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Meal Plan */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Today&apos;s Plan</h3>
            <span className="text-xs text-slate-400">{today}</span>
          </div>

          <div className="space-y-4 mb-6">
            {MEAL_SLOTS.map(({ slot, label }) => {
              const slotEntries = entries.map((e, i) => ({ ...e, idx: i })).filter((e) => e.slot === slot);
              return (
                <div key={slot} className="bg-white rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">{label}</h4>
                  {slotEntries.length === 0 ? (
                    <p className="text-xs text-slate-400">Nothing added</p>
                  ) : (
                    <ul className="space-y-1">
                      {slotEntries.map(({ idx, foodItemId }) => {
                        const food = foods.find((f) => f.id === foodItemId);
                        if (!food) return null;
                        return (
                          <li key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700">{food.name}</span>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span>{food.calories} kcal</span>
                              <button onClick={() => removeEntry(idx)} className="text-slate-300 hover:text-red-500">
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
            <div className="bg-indigo-50 rounded-xl p-4 mb-4">
              <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">Daily Totals</h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Calories", value: Math.round(totals.calories), unit: "kcal" },
                  { label: "Protein", value: Math.round(totals.protein), unit: "g" },
                  { label: "Carbs", value: Math.round(totals.carbs), unit: "g" },
                  { label: "Fat", value: Math.round(totals.fat), unit: "g" },
                ].map(({ label, value, unit }) => (
                  <div key={label}>
                    <p className="text-lg font-bold text-indigo-900">{value}<span className="text-xs font-normal ml-0.5">{unit}</span></p>
                    <p className="text-xs text-indigo-600">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={savePlan}
            disabled={saving || entries.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : saved ? "Saved!" : "Save Meal Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
