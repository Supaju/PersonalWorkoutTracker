"use client";

import { useEffect, useState } from "react";
import type { WeekDay } from "@/components/coach/types";
import { api, sessionLabel, DAY_NAMES } from "@/components/coach/types";

export default function WeekStrip() {
  const [days, setDays] = useState<WeekDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await api<WeekDay[]>("/api/week");
        setDays(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load week");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="card">
        <p className="text-xs text-[var(--color-text-muted)]">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="text-xs text-[var(--color-warn)]">{error}</p>
      </div>
    );
  }

  if (!days || days.length === 0) {
    return (
      <div className="card">
        <p className="text-xs text-[var(--color-text-muted)]">No week data</p>
      </div>
    );
  }

  const statusStyles: Record<WeekDay["status"], string> = {
    done: "border-[var(--color-ok)]",
    today: "border-[var(--color-accent)] text-[var(--color-accent)]",
    upcoming: "border-[var(--color-border)]",
    rest: "text-[var(--color-text-muted)]",
    missed: "border-[var(--color-warn)] text-[var(--color-warn)]",
  };

  return (
    <div className="card">
      <p className="label mb-3">This week</p>
      <div className="grid grid-cols-7 gap-1 w-full max-w-[390px]">
        {days.map((day) => {
          const dayName = DAY_NAMES[day.weekday];
          const dateObj = new Date(day.date);
          const dayOfMonth = dateObj.getDate();
          const borderClass = statusStyles[day.status];

          let statusText = "";
          if (day.status === "done") statusText = "✓ Done";
          else if (day.status === "today") statusText = "Today";
          else if (day.status === "rest") statusText = "Rest";
          else if (day.status === "missed") statusText = "Missed";

          return (
            <div
              key={day.date}
              className={`border rounded p-2 text-center text-[11px] ${borderClass}`}
            >
              <p className="font-medium">{dayName}</p>
              <p className="text-[10px]">{dayOfMonth}</p>
              {statusText && <p className="text-[10px] mt-1">{statusText}</p>}
              {day.sessionType && (
                <p className="text-[10px] mt-1 truncate">{sessionLabel(day.sessionType)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
