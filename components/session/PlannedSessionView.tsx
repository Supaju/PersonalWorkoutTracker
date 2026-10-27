"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ApiSession,
  ApiExercise,
  parsePlan,
  parsePrescription,
  plannedCardioFor,
  pairLabels,
  loadText,
  BLOCK_LABEL,
  BLOCK_ORDER,
  sessionLabel,
  Preference,
} from "@/components/session/types";
import WeekView from "@/components/session/WeekView";

interface ExerciseDetailBottomSheetProps {
  exercise: ApiExercise;
  session: ApiSession;
  isOpen: boolean;
  onClose: () => void;
}

function ExerciseDetailBottomSheet({ exercise, session, isOpen, onClose }: ExerciseDetailBottomSheetProps) {
  const [lastSets, setLastSets] = useState<any[]>([]);
  const [trend, setTrend] = useState<any>(null);
  const [substitutes, setSubstitutes] = useState<Preference[]>([]);
  const [loadingLast, setLoadingLast] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Fetch last session with this exercise
    setLoadingLast(true);
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((sessions: ApiSession[]) => {
        const recorded = sessions.filter((s) => s.phase === "recorded" && new Date(s.date) < new Date(session.date));
        for (const s of recorded.reverse()) {
          const ex = s.exercises.find((e) => e.name === exercise.name);
          if (ex) {
            setLastSets(ex.sets.map((set) => `${set.weightLbs} × ${set.reps}${set.rir !== null ? ` · RIR ${set.rir}` : ""}`));
            break;
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingLast(false));

    // Fetch progress data
    setLoadingProgress(true);
    fetch("/api/progress")
      .then((res) => res.json())
      .then((data: any) => {
        const ex = data.exercises?.find((e: any) => e.name.toLowerCase() === exercise.name.toLowerCase());
        if (ex?.series?.length) {
          const last6 = ex.series.slice(-6).map((point: any) => ({
            date: point.date,
            weight: point.topWeight,
            e1rm: point.e1rm,
          }));
          setTrend(last6);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProgress(false));

    // Fetch preferences
    setLoadingPrefs(true);
    fetch("/api/preferences")
      .then((res) => res.json())
      .then((prefs: Preference[]) => {
        const subs = prefs.filter((p) => p.kind === "substitute" && p.substituteFor === exercise.name);
        setSubstitutes(subs);
      })
      .catch(() => {})
      .finally(() => setLoadingPrefs(false));
  }, [isOpen, exercise.name, session.date]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="absolute bottom-0 left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--color-text)]">{exercise.name}</h3>
            <button
              onClick={onClose}
              className="min-h-[48px] min-w-[48px] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Close
            </button>
          </div>

          {/* Why this target */}
          {exercise.aiNotes && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
                Why this target
              </h4>
              <p className="text-sm text-[var(--color-text)]">{exercise.aiNotes}</p>
            </div>
          )}

          {/* Last time */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Last time</h4>
            {loadingLast ? (
              <p className="text-sm text-[var(--color-text-faint)]">Loading…</p>
            ) : lastSets.length > 0 ? (
              <ul className="text-sm text-[var(--color-text)] space-y-1">
                {lastSets.map((set, i) => (
                  <li key={i}>{set}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-text-faint)]">—</p>
            )}
          </div>

          {/* Recent trend */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Recent trend</h4>
            {loadingProgress ? (
              <p className="text-sm text-[var(--color-text-faint)]">Loading…</p>
            ) : trend && trend.length > 0 ? (
              <div className="text-sm text-[var(--color-text)] space-y-1">
                {trend.map((point: any, i: number) => {
                  const prev = i > 0 ? trend[i - 1] : null;
                  const arrow = prev && point.weight > prev.weight ? " ↑" : prev && point.weight < prev.weight ? " ↓" : "";
                  return (
                    <div key={i}>
                      {point.date} {point.weight} lb {point.e1rm ? `(est. 1RM ${point.e1rm})` : ""}{arrow}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-faint)]">—</p>
            )}
          </div>

          {/* Approved substitutes */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Approved substitutes</h4>
            {loadingPrefs ? (
              <p className="text-sm text-[var(--color-text-faint)]">Loading…</p>
            ) : substitutes.length > 0 ? (
              <div className="text-sm text-[var(--color-text)] space-y-1">
                {substitutes.map((s) => (
                  <div key={s.id}>{s.exerciseName}</div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-faint)]">—</p>
            )}
          </div>

          {/* Setup / safety */}
          {exercise.cue && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Setup / safety</h4>
              <p className="text-sm text-[var(--color-text)]">{exercise.cue}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlannedSessionView({ session }: { session: ApiSession }) {
  const plan = parsePlan(session);
  const [selectedExercise, setSelectedExercise] = useState<ApiExercise | null>(null);
  const estimatedMinutes = plan?.estimatedMinutes ?? session.estimatedMinutes;

  // Group exercises by block
  const exercisesByBlock = new Map<string, ApiExercise[]>();
  const sorted = [...session.exercises].sort((a, b) => a.orderIndex - b.orderIndex);
  for (const ex of sorted) {
    if (!exercisesByBlock.has(ex.block)) {
      exercisesByBlock.set(ex.block, []);
    }
    exercisesByBlock.get(ex.block)!.push(ex);
  }

  return (
    <div className="pb-20">
      <WeekView />

      {/* Header */}
      <div className="mb-8 mt-8">
        <div className="flex items-baseline gap-4 mb-2">
          <h1 className="text-3xl font-bold text-[var(--color-text)] uppercase tracking-wide">
            {session.name || sessionLabel(session.sessionType)}
          </h1>
          <span className="text-sm text-[var(--color-text-muted)]">{session.date}</span>
        </div>
        {estimatedMinutes && (
          <p className="text-lg font-bold text-[var(--color-text-muted)]">
            ~{estimatedMinutes} min total
          </p>
        )}
      </div>

      {/* Coach notes */}
      {(session.coachNotes || plan?.coachNotes) && (
        <details className="mb-8 bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
          <summary className="font-bold text-[var(--color-text)] cursor-pointer">Coach notes</summary>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            {session.coachNotes || plan?.coachNotes}
          </p>
        </details>
      )}

      {/* Blocks */}
      <div className="space-y-6">
        {BLOCK_ORDER.map((blockName) => {
          const exercises = exercisesByBlock.get(blockName) ?? [];
          if (exercises.length === 0) return null;

          const blockPlan = plan?.blocks.find((b) => b.block === blockName);
          const blockMinutes = blockPlan?.estimatedMinutes ?? null;

          return (
            <div key={blockName}>
              <h2 className="text-lg font-bold text-[var(--color-text)] uppercase tracking-wide mb-4">
                {BLOCK_LABEL[blockName] || blockName}
                {blockMinutes ? ` · ${blockMinutes} min` : ""}
              </h2>

              <div className="space-y-3">
                {exercises.map((ex, idx) => {
                  const prescription = parsePrescription(ex);
                  const cardio = plannedCardioFor(session, ex);
                  const pairLabelsForBlock = pairLabels(
                    exercises.map((e) => ({ block: e.block, pairGroup: e.pairGroup }))
                  );
                  const pairLabel = pairLabelsForBlock[idx];
                  const isLastInPair =
                    pairLabel && idx < exercises.length - 1 && exercises[idx + 1].pairGroup === ex.pairGroup;

                  return (
                    <div key={ex.id}>
                      <button
                        onClick={() => setSelectedExercise(ex)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] p-4 text-left min-h-[64px] transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-bold text-[var(--color-text)]">
                            {ex.name} {pairLabel && <span className="text-xs text-[var(--color-text-muted)]">({pairLabel})</span>}
                          </h3>
                        </div>

                        {/* Prescription rows */}
                        {prescription.length > 0 && (
                          <div className="space-y-1 text-sm">
                            {prescription.map((set, i) => {
                              if (set.setType === "ramp") {
                                return (
                                  <div key={i} className="text-xs text-[var(--color-text-faint)]">
                                    <span className="font-medium">Ramp</span>
                                  </div>
                                );
                              }
                              if (set.setType === "working") {
                                return (
                                  <div key={i} className="font-bold text-[var(--color-text)]">
                                    {ex.unit === "cardio" ? (
                                      <>
                                        {set.durationSec && <span>{set.durationSec}s hold</span>}
                                      </>
                                    ) : ex.unit === "time" ? (
                                      <span>{set.durationSec}s hold</span>
                                    ) : ex.unit === "distance" ? (
                                      <span>{set.distanceYd} yd</span>
                                    ) : ex.unit === "bodyweight" ? (
                                      <span>BW × {set.reps} reps</span>
                                    ) : (
                                      <>
                                        {loadText(ex.unit, set.weight)} × {set.reps}
                                      </>
                                    )}
                                    {set.targetRir !== null && <span> · RIR {set.targetRir}</span>}
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        )}

                        {/* Cardio info */}
                        {cardio && (
                          <div className="text-xs text-[var(--color-text-muted)] mt-2">
                            {cardio.machine} · {cardio.minutes} min {cardio.intervals && `· ${cardio.intervals}`}
                            {cardio.settings && ` · ${cardio.settings}`}
                          </div>
                        )}

                        {/* Cue */}
                        {ex.cue && (
                          <p className="text-xs text-[var(--color-text-faint)] mt-2 italic">{ex.cue}</p>
                        )}

                        {/* Rest */}
                        {ex.restSec && (
                          <p className="text-xs text-[var(--color-text-faint)] mt-2">
                            {isLastInPair ? `rest ${ex.restSec}s between pairs` : `rest ${ex.restSec}s`}
                          </p>
                        )}
                      </button>

                      {isLastInPair && <div className="h-px bg-[var(--color-border)] my-2" />}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--color-bg)] border-t border-[var(--color-border)] p-4">
        <div className="max-w-4xl mx-auto px-8 flex flex-col gap-3">
          <Link
            href={`/sessions/${session.id}/record`}
            className="btn-accent w-full justify-center min-h-[56px] text-sm"
          >
            Start workout
          </Link>
          <Link
            href={`/sessions/${session.id}/print`}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-center"
          >
            Print sheet
          </Link>
        </div>
      </div>

      {/* Exercise detail sheet */}
      <ExerciseDetailBottomSheet
        exercise={selectedExercise!}
        session={session}
        isOpen={!!selectedExercise}
        onClose={() => setSelectedExercise(null)}
      />
    </div>
  );
}
