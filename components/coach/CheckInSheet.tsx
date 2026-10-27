"use client";

import { useState, useEffect } from "react";
import { api, areaLabel, localDate } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
};

type SorenessLevel = "none" | "mild" | "significant";

type SorenessRecord = Record<string, SorenessLevel>;

type CheckInFormState = {
  soreness: SorenessRecord;
  sleep: "poor" | "ok" | "good" | null;
  energy: "low" | "normal" | "high" | null;
  minutesAvailable: number | null;
  painNotes: string;
};

const AREAS = [
  "chest",
  "shoulders",
  "upper_back",
  "lats",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "lower_back",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "abductors",
  "calves",
];

export default function CheckInSheet({ open, onClose, onDone }: Props) {
  const [formState, setFormState] = useState<CheckInFormState>({
    soreness: {},
    sleep: null,
    energy: null,
    minutesAvailable: 60,
    painNotes: "",
  });

  const [hasStoredCheckIn, setHasStoredCheckIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Check for stored last check-in on mount and when sheet opens
  useEffect(() => {
    if (open) {
      try {
        const stored = localStorage.getItem("lastCheckIn");
        setHasStoredCheckIn(!!stored);
      } catch {
        setHasStoredCheckIn(false);
      }
    }
  }, [open]);

  const applySameAsLastTime = () => {
    try {
      const stored = localStorage.getItem("lastCheckIn");
      if (!stored) return;
      const lastCheckIn = JSON.parse(stored) as CheckInFormState;
      setFormState(lastCheckIn);
    } catch {
      // Silently fail if localStorage read/parse fails
    }
  };

  const applyFeelingGood = () => {
    setFormState({
      soreness: {},
      sleep: "good",
      energy: "high",
      minutesAvailable: 60,
      painNotes: "",
    });
  };

  const toggleSoreness = (area: string) => {
    setFormState((prev) => {
      const current = prev.soreness[area] || "none";
      const next: SorenessLevel =
        current === "none" ? "mild" : current === "mild" ? "significant" : "none";

      const updated = { ...prev.soreness };
      if (next === "none") {
        delete updated[area];
      } else {
        updated[area] = next;
      }

      return { ...prev, soreness: updated };
    });
  };

  const setSleep = (value: "poor" | "ok" | "good") => {
    setFormState((prev) => ({
      ...prev,
      sleep: prev.sleep === value ? null : value,
    }));
  };

  const setEnergy = (value: "low" | "normal" | "high") => {
    setFormState((prev) => ({
      ...prev,
      energy: prev.energy === value ? null : value,
    }));
  };

  const setMinutes = (value: number) => {
    setFormState((prev) => ({
      ...prev,
      minutesAvailable: prev.minutesAvailable === value ? null : value,
    }));
  };

  const composeCheckInSummary = (): string => {
    const parts: string[] = [];

    if (formState.sleep) {
      parts.push(`sleep ${formState.sleep}`);
    }

    if (formState.energy) {
      parts.push(`energy ${formState.energy}`);
    }

    const soreness = Object.entries(formState.soreness)
      .map(
        ([area, level]) =>
          `${areaLabel(area)}${level === "mild" ? " (mild)" : level === "significant" ? " (significant)" : ""}`
      )
      .join(", ");
    if (soreness) {
      parts.push(`sore: ${soreness}`);
    }

    if (formState.minutesAvailable) {
      parts.push(`${formState.minutesAvailable} min available`);
    }

    return `Check-in: ${parts.join(", ")}.`;
  };

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      // Step 1: POST check-in
      const checkInPayload: Record<string, unknown> = {
        kind: "pre",
        date: localDate(),
      };

      if (Object.keys(formState.soreness).length > 0) {
        checkInPayload.soreness = formState.soreness;
      }
      if (formState.sleep) {
        checkInPayload.sleep = formState.sleep;
      }
      if (formState.energy) {
        checkInPayload.energy = formState.energy;
      }
      if (formState.minutesAvailable) {
        checkInPayload.minutesAvailable = formState.minutesAvailable;
      }
      if (formState.painNotes.trim()) {
        checkInPayload.painNotes = formState.painNotes.trim();
      }

      const checkInRes = await api<{ id: string }>("/api/checkins", checkInPayload);

      // Step 2: Save to localStorage
      try {
        localStorage.setItem("lastCheckIn", JSON.stringify(formState));
      } catch {
        // Silently ignore localStorage failures
      }

      // Step 3: Plan session
      await api("/api/sessions/plan", {
        date: localDate(),
        checkInId: checkInRes.id,
      });

      // Step 4: Post to coach (fire-and-forget)
      const summary = composeCheckInSummary();
      api("/api/coach/messages", {
        text: `${summary} Plan is ready.`,
      }).catch(() => {
        // Ignore coach message failures
      });

      // Step 5: Call callbacks
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 rounded-t-lg max-h-[90vh] overflow-y-auto md:fixed md:inset-0 md:flex md:items-center md:justify-center md:rounded-t-lg md:bottom-auto md:left-auto md:right-auto md:top-auto md:max-w-md md:mx-auto md:my-auto md:h-auto md:rounded-lg md:bg-[var(--color-surface)]"
        style={{
          backgroundColor: "var(--color-surface)",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Close button and header */}
        <div className="sticky top-0 flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] z-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text)]">
            Check In
          </h2>
          <button
            onClick={onClose}
            aria-label="Close check-in sheet"
            className="w-11 h-11 flex items-center justify-center text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-6">
          {/* Shortcuts */}
          <div className="flex gap-2">
            {hasStoredCheckIn && (
              <button
                onClick={applySameAsLastTime}
                className="btn-ghost flex-1 text-xs"
              >
                Same as last time
              </button>
            )}
            <button
              onClick={applyFeelingGood}
              className="btn-ghost flex-1 text-xs"
            >
              Feeling good, let's go
            </button>
          </div>

          {/* Soreness */}
          <div>
            <label className="label">Sore areas</label>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((area) => {
                const level = formState.soreness[area] || "none";
                const isActive = level !== "none";
                return (
                  <button
                    key={area}
                    onClick={() => toggleSoreness(area)}
                    className="chip"
                    aria-pressed={isActive}
                  >
                    {areaLabel(area)}
                    {level === "mild" && " (mild)"}
                    {level === "significant" && " (sig)"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sleep */}
          <div>
            <label className="label">Sleep</label>
            <div className="flex gap-2">
              {["poor", "ok", "good"].map((value) => (
                <button
                  key={value}
                  onClick={() => setSleep(value as "poor" | "ok" | "good")}
                  className="chip flex-1"
                  aria-pressed={formState.sleep === value}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {/* Energy */}
          <div>
            <label className="label">Energy</label>
            <div className="flex gap-2">
              {["low", "normal", "high"].map((value) => (
                <button
                  key={value}
                  onClick={() => setEnergy(value as "low" | "normal" | "high")}
                  className="chip flex-1"
                  aria-pressed={formState.energy === value}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes available */}
          <div>
            <label className="label">Time available</label>
            <div className="flex gap-2 flex-wrap">
              {[30, 40, 50, 60, 75, 90].map((value) => (
                <button
                  key={value}
                  onClick={() => setMinutes(value)}
                  className="chip"
                  aria-pressed={formState.minutesAvailable === value}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {/* Pain notes */}
          <div>
            <label className="label">Pain or issues</label>
            <input
              type="text"
              value={formState.painNotes}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  painNotes: e.target.value,
                }))
              }
              placeholder="Anything hurting? (optional)"
              className="input"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 text-xs text-[#f87171] bg-[#1a0505] border-t border-[#3a1010]">
            {error}
          </div>
        )}

        {/* Submit button */}
        <div className="px-4 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="btn-accent w-full min-h-[48px]"
          >
            {busy ? "Planning your session…" : "Check in & plan today"}
          </button>
        </div>
      </div>
    </>
  );
}
