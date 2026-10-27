"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, DAY_NAMES, type ClientSettings } from "@/components/coach/types";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun

export default function ScheduleForm({ client }: { client: ClientSettings }) {
  const router = useRouter();
  const [trainingDays, setTrainingDays] = useState<number[]>(client.trainingDays);
  const [defaultMinutes, setDefaultMinutes] = useState(client.defaultMinutes.toString());
  const [hardCapMinutes, setHardCapMinutes] = useState(client.hardCapMinutes.toString());
  const [layoffDays, setLayoffDays] = useState(client.layoffDays.toString());
  const [reviewEveryWeeks, setReviewEveryWeeks] = useState(client.reviewEveryWeeks.toString());
  const [webResearch, setWebResearch] = useState(client.webResearch);
  const [persona, setPersona] = useState(client.persona);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleTrainingDay = (day: number) => {
    setTrainingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const validateForm = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    const parseAndValidate = (value: string, fieldName: string): number | null => {
      const num = parseInt(value, 10);
      if (!value.trim() || isNaN(num) || !Number.isInteger(num) || num <= 0) {
        newErrors[fieldName] = `${fieldName} must be a positive integer`;
        return null;
      }
      return num;
    };

    parseAndValidate(defaultMinutes, "Default minutes per session");
    parseAndValidate(hardCapMinutes, "Hard cap minutes");
    parseAndValidate(layoffDays, "Days away before re-entry session");
    parseAndValidate(reviewEveryWeeks, "Program review every N weeks");

    if (!persona.trim()) {
      newErrors.persona = "Coach persona cannot be empty";
    }

    return newErrors;
  };

  const handleSave = async () => {
    const formErrors = validateForm();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        defaultMinutes: parseInt(defaultMinutes, 10),
        hardCapMinutes: parseInt(hardCapMinutes, 10),
        layoffDays: parseInt(layoffDays, 10),
        reviewEveryWeeks: parseInt(reviewEveryWeeks, 10),
        webResearch,
        persona: persona.trim(),
      };

      if (trainingDays.length > 0) {
        payload.trainingDays = trainingDays;
      }

      await api(`/api/clients/${client.id}`, payload, "PATCH");

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } catch (err) {
      setErrors({ submit: (err as Error).message || "Failed to save settings" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="space-y-6">
        {/* Schedule Section */}
        <fieldset className="space-y-4">
          <legend className="label font-semibold">Schedule</legend>

          {/* Training Days */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 justify-center">
              {WEEKDAY_ORDER.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleTrainingDay(day)}
                  aria-pressed={trainingDays.includes(day)}
                  className="chip min-w-[44px] justify-center"
                >
                  {DAY_NAMES[day]}
                </button>
              ))}
            </div>
          </div>

          {/* Number Inputs */}
          <div className="space-y-4">
            <div>
              <label className="label">Default minutes per session</label>
              <input
                type="number"
                inputMode="numeric"
                className="input w-full"
                value={defaultMinutes}
                onChange={(e) => {
                  setDefaultMinutes(e.target.value);
                  if (errors.defaultMinutes) {
                    setErrors({ ...errors, defaultMinutes: "" });
                  }
                }}
              />
              {errors["Default minutes per session"] && (
                <p className="text-xs text-[color:var(--color-error,#dc2626)] mt-1">
                  {errors["Default minutes per session"]}
                </p>
              )}
            </div>

            <div>
              <label className="label">Hard cap minutes</label>
              <input
                type="number"
                inputMode="numeric"
                className="input w-full"
                value={hardCapMinutes}
                onChange={(e) => {
                  setHardCapMinutes(e.target.value);
                  if (errors.hardCapMinutes) {
                    setErrors({ ...errors, hardCapMinutes: "" });
                  }
                }}
              />
              {errors["Hard cap minutes"] && (
                <p className="text-xs text-[color:var(--color-error,#dc2626)] mt-1">
                  {errors["Hard cap minutes"]}
                </p>
              )}
            </div>

            <div>
              <label className="label">Days away before re-entry session</label>
              <input
                type="number"
                inputMode="numeric"
                className="input w-full"
                value={layoffDays}
                onChange={(e) => {
                  setLayoffDays(e.target.value);
                  if (errors.layoffDays) {
                    setErrors({ ...errors, layoffDays: "" });
                  }
                }}
              />
              {errors["Days away before re-entry session"] && (
                <p className="text-xs text-[color:var(--color-error,#dc2626)] mt-1">
                  {errors["Days away before re-entry session"]}
                </p>
              )}
            </div>

            <div>
              <label className="label">Program review every N weeks</label>
              <input
                type="number"
                inputMode="numeric"
                className="input w-full"
                value={reviewEveryWeeks}
                onChange={(e) => {
                  setReviewEveryWeeks(e.target.value);
                  if (errors.reviewEveryWeeks) {
                    setErrors({ ...errors, reviewEveryWeeks: "" });
                  }
                }}
              />
              {errors["Program review every N weeks"] && (
                <p className="text-xs text-[color:var(--color-error,#dc2626)] mt-1">
                  {errors["Program review every N weeks"]}
                </p>
              )}
            </div>
          </div>

          {/* Web Research Checkbox */}
          <div className="flex items-center h-[44px]">
            <input
              type="checkbox"
              id="webResearch"
              className="accent-[var(--color-accent)]"
              checked={webResearch}
              onChange={(e) => setWebResearch(e.target.checked)}
            />
            <label htmlFor="webResearch" className="label ml-3 cursor-pointer">
              Let the coach search the web for research
            </label>
          </div>
        </fieldset>

        {/* Persona Section */}
        <fieldset className="space-y-2">
          <legend className="label font-semibold">Coach persona</legend>
          <textarea
            className="input w-full"
            rows={6}
            value={persona}
            onChange={(e) => {
              setPersona(e.target.value);
              if (errors.persona) {
                setErrors({ ...errors, persona: "" });
              }
            }}
          />
          <p className="text-xs text-[color:var(--color-muted,#6b7280)]">
            How your coach talks to you. Calm and direct works well.
          </p>
          {errors.persona && (
            <p className="text-xs text-[color:var(--color-error,#dc2626)] mt-1">{errors.persona}</p>
          )}
        </fieldset>

        {/* Submit Error */}
        {errors.submit && (
          <p className="text-xs text-[color:var(--color-error,#dc2626)]">{errors.submit}</p>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={loading || saved}
        className="btn-accent w-full min-h-[44px] mt-6"
      >
        {saved ? "Saved" : loading ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
