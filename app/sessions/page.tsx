"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WeekView from "@/components/session/WeekView";
import { sessionLabel, parseReview, type ApiSession } from "@/components/session/types";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const res = await globalThis.fetch("/api/sessions");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    loadSessions();
  }, []);

  const filteredSessions = sessions.filter((s) => s.phase === "recorded" || s.phase === "active" || s.phase === "planned");

  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-text)] mb-6 uppercase tracking-wide">Sessions</h2>

      <WeekView />

      <div className="flex flex-col gap-3 mb-6">
        <Link
          href="/sessions/today"
          className="min-h-[48px] px-4 py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium text-sm hover:opacity-90 transition-opacity text-center"
        >
          Today's workout
        </Link>
        <Link
          href="/sessions/new"
          className="min-h-[48px] px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] font-medium text-sm hover:border-[var(--color-accent)] transition-colors text-center"
        >
          Log a past workout
        </Link>
      </div>

      {error ? (
        <div className="text-[var(--color-text-faint)] text-sm">Error loading sessions</div>
      ) : loading ? (
        <div className="space-y-3">
          {Array(3)
            .fill(null)
            .map((_, i) => (
              <div
                key={i}
                className="h-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl animate-pulse"
              />
            ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-[var(--color-text-faint)] text-sm text-center py-8">No sessions yet.</div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const review = parseReview(session);
            const dateObj = new Date(`${session.date}T00:00:00`);
            const formattedDate = dateObj.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });

            const phaseLabel =
              session.phase === "planned" ? "Planned" : session.phase === "active" ? "Active" : null;

            return (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="block min-h-[64px] px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {formattedDate}
                    </span>
                    {phaseLabel && (
                      <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                        {phaseLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    {sessionLabel(session.sessionType)}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  {session.durationMin && (
                    <span className="text-xs text-[var(--color-text-faint)]">
                      {session.durationMin} min
                    </span>
                  )}
                </div>

                {review?.summary && (
                  <p className="text-xs text-[var(--color-text-faint)] line-clamp-2">
                    {review.summary}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
