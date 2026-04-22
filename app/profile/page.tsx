"use client";

import { useState, useEffect } from "react";
import { GOAL_LABELS, type Goal } from "@/lib/types";

const GOALS = Object.entries(GOAL_LABELS) as [Goal, string][];

export default function ProfilePage() {
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "male",
    heightFt: "",
    heightIn: "",
    weightLbs: "",
    goals: "build_muscle",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          const totalInches = data.heightIn || 0;
          setForm({
            name: data.name || "",
            age: String(data.age || ""),
            gender: data.gender || "male",
            heightFt: String(Math.floor(totalInches / 12) || ""),
            heightIn: String(totalInches % 12 || ""),
            weightLbs: String(data.weightLbs || ""),
            goals: data.goals || "build_muscle",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <div className="text-slate-400 text-sm">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Your Profile</h2>
      <p className="text-slate-500 text-sm mb-8">This information shapes all AI recommendations.</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name (optional)</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Your name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
            <input
              type="number"
              required
              min={10}
              max={100}
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="28"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Height</label>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                required
                min={3}
                max={8}
                value={form.heightFt}
                onChange={(e) => setForm({ ...form, heightFt: e.target.value })}
                placeholder="5"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-500 shrink-0">ft</span>
            </div>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                required
                min={0}
                max={11}
                value={form.heightIn}
                onChange={(e) => setForm({ ...form, heightIn: e.target.value })}
                placeholder="10"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-500 shrink-0">in</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Weight</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              required
              min={60}
              max={700}
              step={0.5}
              value={form.weightLbs}
              onChange={(e) => setForm({ ...form, weightLbs: e.target.value })}
              placeholder="175"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-500 shrink-0">lbs</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Primary Goal</label>
          <div className="space-y-2">
            {GOALS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="goal"
                  value={value}
                  checked={form.goals === value}
                  onChange={() => setForm({ ...form, goals: value })}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
