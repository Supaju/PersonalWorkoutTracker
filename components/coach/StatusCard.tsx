"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  api,
  type Today,
  sessionLabel,
  areaLabel,
  localDate,
} from "@/components/coach/types";

interface StatusCardProps {
  onAskCoach?: (text: string) => void;
}

export default function StatusCard({ onAskCoach }: StatusCardProps) {
  const [data, setData] = useState<Today | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState<Set<string>>(new Set());
  const [checkinAreas, setCheckinAreas] = useState<
    Record<string, "none" | "mild" | "significant">
  >({});
  const [savingCheckin, setSavingCheckin] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = await api<Today>("/api/today");
      setData(today);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleQuestionAnswer = async (
    questionId: string,
    answer: string
  ) => {
    setAnswering((prev) => new Set([...prev, questionId]));
    try {
      await api(`/api/questions/${questionId}/answer`, { answer });
      await load();
    } catch (err) {
      console.error("Failed to answer question:", err);
    } finally {
      setAnswering((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    }
  };

  const handleCheckinSave = async () => {
    if (!data?.lastSession || Object.keys(checkinAreas).length === 0) return;
    setSavingCheckin(true);
    try {
      await api("/api/checkins", {
        kind: "next_day",
        date: localDate(),
        sessionId: data.lastSession.id,
        soreness: checkinAreas,
      });
      await load();
    } catch (err) {
      console.error("Failed to save checkin:", err);
    } finally {
      setSavingCheckin(false);
    }
  };

  const handleAllGood = async () => {
    if (!data?.needsNextDayCheck) return;
    const allNone: Record<string, "none" | "mild" | "significant"> = Object.fromEntries(
      data.needsNextDayCheck.areas.map((area) => [area, "none" as const])
    );
    setCheckinAreas(allNone);
    setSavingCheckin(true);
    try {
      await api("/api/checkins", {
        kind: "next_day",
        date: localDate(),
        sessionId: data.lastSession?.id,
        soreness: allNone,
      });
      await load();
    } catch (err) {
      console.error("Failed to save checkin:", err);
    } finally {
      setSavingCheckin(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="h-32 bg-[var(--color-bg-secondary)] animate-pulse rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-text-muted)]">{error}</p>
          <button
            onClick={() => load()}
            className="btn btn-ghost text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const reasonsList = data.reasons.slice(0, 3);

  return (
    <div className="card">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs uppercase text-[var(--color-text-muted)] tracking-wider">
          Today
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          {data.date}
        </p>

        {data.activeSession ? (
          <div className="flex flex-col gap-2">
            <p className="text-base font-semibold">
              Workout in progress: {data.activeSession.name ?? sessionLabel(data.activeSession.sessionType)}
            </p>
            <Link
              href={`/sessions/${data.activeSession.id}`}
              className="btn btn-accent self-start"
            >
              Continue
            </Link>
          </div>
        ) : data.plannedSession ? (
          <div className="flex flex-col gap-2">
            <p className="text-base font-semibold">
              {data.plannedSession.name ?? sessionLabel(data.plannedSession.sessionType)} planned
            </p>
            <Link
              href={`/sessions/${data.plannedSession.id}`}
              className="btn btn-accent self-start"
            >
              Open plan
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-base font-semibold">
              Suggested: {sessionLabel(data.suggestedSessionType)}
            </p>
            <button
              onClick={() => onAskCoach?.("Plan today")}
              className="btn btn-ghost self-start"
            >
              Plan today
            </button>
          </div>
        )}

        {reasonsList.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-[var(--color-text-muted)]">
            {reasonsList.map((reason, i) => (
              <li key={i}>• {reason}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Last session */}
      {data.lastSession && (
        <div className="mb-6 pb-6 border-b border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            Last: {sessionLabel(data.lastSession.sessionType)} on {data.lastSession.date}
          </p>
          {data.lastSession.summary && (
            <p className="text-sm mb-2">{data.lastSession.summary}</p>
          )}
          <Link
            href={`/sessions/${data.lastSession.id}`}
            className="text-sm text-[var(--color-text-accent)] underline"
          >
            View session
          </Link>
        </div>
      )}

      {/* Pending questions */}
      {data.pendingQuestions.length > 0 && (
        <div className="mb-6 pb-6 border-b border-[var(--color-border)]">
          {data.pendingQuestions.map((q) => {
            let options: string[] = [];
            try {
              options = JSON.parse(q.options);
            } catch {}

            return (
              <div key={q.id} className="mb-4 last:mb-0">
                <p className="text-sm mb-3">
                  {q.exerciseName && (
                    <span className="font-semibold">{q.exerciseName}</span>
                  )}
                  {q.exerciseName && " — "}
                  {q.question}
                </p>

                {options.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleQuestionAnswer(q.id, opt)}
                        disabled={answering.has(q.id)}
                        className="chip"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Your answer…"
                    className="input flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value) {
                        handleQuestionAnswer(q.id, e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                    disabled={answering.has(q.id)}
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousSibling as HTMLInputElement);
                      if (input?.value) {
                        handleQuestionAnswer(q.id, input.value);
                        input.value = "";
                      }
                    }}
                    disabled={answering.has(q.id)}
                    className="btn btn-sm btn-primary"
                  >
                    Send
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending proposals */}
      {data.pendingProposals.length > 0 && (
        <div className="mb-6 pb-6 border-b border-[var(--color-border)]">
          {data.pendingProposals.map((p) => (
            <div key={p.id}>
              <p className="text-sm mb-2">
                Coach proposed a program change: {p.recommendation}
              </p>
              <Link
                href="/program"
                className="text-sm text-[var(--color-text-accent)] underline"
              >
                Review program
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Next day check */}
      {data.needsNextDayCheck && (
        <div>
          <p className="text-sm font-semibold mb-4">
            How are you feeling after yesterday's session?
          </p>
          <div className="space-y-4 mb-4">
            {data.needsNextDayCheck.areas.map((area) => (
              <div key={area}>
                <p className="text-xs text-[var(--color-text-muted)] mb-2 capitalize">
                  {areaLabel(area)}
                </p>
                <div className="flex gap-2">
                  {(["none", "mild", "significant"] as const).map((val) => (
                    <button
                      key={val}
                      onClick={() =>
                        setCheckinAreas((prev) => ({
                          ...prev,
                          [area]: val,
                        }))
                      }
                      aria-pressed={checkinAreas[area] === val}
                      className="chip"
                    >
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCheckinSave}
              disabled={savingCheckin || Object.keys(checkinAreas).length === 0}
              className="btn btn-accent"
            >
              Save
            </button>
            <button
              onClick={handleAllGood}
              disabled={savingCheckin}
              className="btn btn-ghost"
            >
              All good
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
