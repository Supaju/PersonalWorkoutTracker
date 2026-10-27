"use client";

import { useState, useEffect } from "react";
import { sessionLabel, type WeekDay } from "@/components/session/types";

export default function WeekView() {
  const [days, setDays] = useState<WeekDay[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadWeek = async () => {
      try {
        const res = await globalThis.fetch("/api/week", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setDays(Array.isArray(data) ? data : null);
      } catch {
        setError(true);
      }
    };
    loadWeek();
  }, []);

  const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

  if (error) {
    return <div className="text-xs text-[var(--color-text-faint)]">Couldn't load week</div>;
  }

  const chips = days ?? Array(7).fill(null);

  return (
    <div className="grid grid-cols-7 gap-1 mb-6">
      {chips.map((day, idx) => {
        const weekdayIdx = (idx + 1) % 7; // Mon = 1, Sun = 0
        const letter = WEEKDAY_LETTERS[idx];
        const dayNum = day ? parseInt(day.date.split("-")[2], 10) : null;

        const statusClass =
          day?.status === "done"
            ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white font-bold"
            : day?.status === "today"
              ? "border-2 border-[var(--color-accent)] font-bold text-[var(--color-text)]"
              : day?.status === "missed"
                ? "border-2 border-dashed border-[var(--color-text-faint)] text-[var(--color-text-faint)]"
                : day?.status === "rest"
                  ? "border border-[var(--color-border)] text-[var(--color-text-faint)]"
                  : "border border-[var(--color-border)] text-[var(--color-text)]";

        const label =
          day?.status === "missed"
            ? "missed"
            : day?.status === "rest"
              ? "Rest"
              : sessionLabel(day?.sessionType);

        return (
          <div
            key={idx}
            className={`min-h-[56px] rounded-xl p-2 flex flex-col items-center justify-center text-center transition-colors ${statusClass} ${day === null ? "bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" : "bg-[var(--color-surface)]"}`}
            aria-label={
              day
                ? `${letter} ${dayNum}, ${day.status}, ${label}`
                : "Loading..."
            }
          >
            {day !== null ? (
              <>
                <div className="text-[11px] font-bold">{letter}</div>
                <div className="text-[11px] font-semibold">{dayNum}</div>
                {day.status === "done" && (
                  <div className="text-xs mt-0.5">✓</div>
                )}
                <div className="text-[11px] truncate leading-tight mt-0.5">{label}</div>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
