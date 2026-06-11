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
    goals: "lose_weight",
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
            goals: data.goals || "lose_weight",
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

  if (loading) return <div className="text-[var(--color-text-faint)] text-sm">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">Your Profile</h2>
      <p className="text-[var(--color-text-faint)] text-sm mb-8">This information shapes all AI recommendations.</p>

      <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 space-y-6 max-w-lg">
        <div>
          <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Name (optional)</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Your name"
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Age</label>
            <input
              type="number"
              required
              min={10}
              max={100}
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="28"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Gender</label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Height</label>
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
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <span className="text-sm text-[var(--color-text-faint)] shrink-0">ft</span>
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
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <span className="text-sm text-[var(--color-text-faint)] shrink-0">in</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Weight</label>
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
              className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <span className="text-sm text-[var(--color-text-faint)] shrink-0">lbs</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1">Primary Goal</label>
          <div className="space-y-2">
            {GOALS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="goal"
                  value={value}
                  checked={form.goals === value}
                  onChange={() => setForm({ ...form, goals: value })}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-accent w-full justify-center text-xs"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
