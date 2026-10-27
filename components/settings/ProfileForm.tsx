"use client";

import { useState, useEffect } from "react";
import { GOAL_LABELS, type Goal } from "@/lib/types";

const GOALS = Object.entries(GOAL_LABELS) as [Goal, string][];

export default function ProfileForm() {
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
  const [error, setError] = useState("");
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
    setError("");
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Failed to save profile. Please try again.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  if (loading)
    return (
      <div className="text-[var(--color-text-faint)] text-sm">Loading...</div>
    );

  return (
    <div className="card">
      <h3 className="label mb-6">Profile</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="label mb-2">Name (optional)</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Your name"
            className="input"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label mb-2">Age</label>
            <input
              type="number"
              required
              min={10}
              max={100}
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="28"
              className="input"
            />
          </div>
          <div>
            <label className="label mb-2">Gender</label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="input"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label mb-2">Height</label>
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
                className="input"
              />
              <span className="text-sm text-[var(--color-text-faint)] shrink-0">
                ft
              </span>
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
                className="input"
              />
              <span className="text-sm text-[var(--color-text-faint)] shrink-0">
                in
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="label mb-2">Weight</label>
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
              className="input flex-1"
            />
            <span className="text-sm text-[var(--color-text-faint)] shrink-0">
              lbs
            </span>
          </div>
        </div>

        <div>
          <label className="label mb-2">Primary Goal</label>
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
                <span className="text-sm text-[var(--color-text-muted)]">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-[var(--color-accent)] text-sm bg-[var(--color-accent)]/10 p-3 rounded">
            {error}
          </div>
        )}

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
