"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GOAL_LABELS, type Goal } from "@/lib/types";
import { api } from "@/components/coach/types";

const GOALS = Object.entries(GOAL_LABELS) as [Goal, string][];

export default function NewClientForm() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "male" as "male" | "female" | "other",
    heightFt: "",
    heightIn: "",
    weightLbs: "",
    goals: "maintain" as Goal,
    defaultMinutes: "60",
  });

  const handleToggle = () => {
    setExpanded(!expanded);
    if (expanded) {
      setForm({
        name: "",
        age: "",
        gender: "male",
        heightFt: "",
        heightIn: "",
        weightLbs: "",
        goals: "maintain" as Goal,
        defaultMinutes: "60",
      });
      setError(null);
    }
  };

  const handleGoalChange = (goal: Goal) => setForm((prev) => ({ ...prev, goals: goal }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const heightIn = Number(form.heightFt) * 12 + Number(form.heightIn);
      const body: {
        name: string;
        profile?: { age: number; gender: string; heightIn: number; weightLbs: number; goals: Goal };
        schedule: { defaultMinutes: number };
      } = {
        name: form.name,
        schedule: { defaultMinutes: Number(form.defaultMinutes) },
      };

      // Only include profile if age, height, and weight are all filled
      if (form.age && form.heightFt && form.weightLbs) {
        body.profile = {
          age: Number(form.age),
          gender: form.gender,
          heightIn,
          weightLbs: Number(form.weightLbs),
          goals: form.goals,
        };
      }

      const response = await api<{ id: string; name: string }>(
        "/api/clients",
        body
      );

      // Select the newly created client
      await api("/api/clients/select", { clientId: response.id });

      // Reset form and close
      setForm({
        name: "",
        age: "",
        gender: "male",
        heightFt: "",
        heightIn: "",
        weightLbs: "",
        goals: "maintain" as Goal,
        defaultMinutes: "60",
      });
      setExpanded(false);

      // Refresh the page to reflect the new client
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create client");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <label className="label">Add a client</label>

      {!expanded ? (
        <button
          onClick={handleToggle}
          className="btn-ghost w-full"
        >
          Add a client
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-[var(--color-warn)] bg-opacity-10 border border-[var(--color-warn)] text-[var(--color-warn)] text-sm rounded">
              {error}
            </div>
          )}

          <div>
            <label className="label">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Client name"
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Age</label>
              <input
                type="number"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="Optional"
                className="input"
              />
            </div>
            <div>
              <label className="label">Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as "male" | "female" | "other" })}
                className="input h-[44px]"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Height</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  value={form.heightFt}
                  onChange={(e) => setForm({ ...form, heightFt: e.target.value })}
                  placeholder="ft"
                  className="input"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  value={form.heightIn}
                  onChange={(e) => setForm({ ...form, heightIn: e.target.value })}
                  placeholder="in"
                  className="input"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Weight (lbs)</label>
            <input
              type="number"
              value={form.weightLbs}
              onChange={(e) => setForm({ ...form, weightLbs: e.target.value })}
              placeholder="Optional"
              className="input"
            />
          </div>

          <div>
            <label className="label">Goals</label>
            <div className="space-y-2">
              {GOALS.map(([goal, label]) => (
                <label key={goal} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="goal"
                    checked={form.goals === goal}
                    onChange={() => handleGoalChange(goal)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-[var(--color-text)]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Default Minutes Per Session</label>
            <input
              type="number"
              value={form.defaultMinutes}
              onChange={(e) => setForm({ ...form, defaultMinutes: e.target.value })}
              placeholder="60"
              className="input"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="btn-accent text-xs"
            >
              {busy ? "Creating..." : "Create client"}
            </button>
            <button
              type="button"
              onClick={handleToggle}
              className="btn-ghost text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
