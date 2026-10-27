import {
  type ApiSession,
  type ApiExercise,
  parsePlan,
  parseReview,
  sessionLabel,
  loadText,
  plannedCardioFor,
} from "@/components/session/types";

export function RecordedCompare({ session }: { session: ApiSession }) {
  const plan = parsePlan(session);
  const review = parseReview(session);

  // Flatten planned exercises by block order for easier lookup
  const plannedExercisesByName = new Map<
    string,
    {
      block: string;
      name: string;
      unit: string;
      sets: Array<{ setType: string; weight: number | null; reps: number | null; targetRir: number | null }>;
      cardio: { machine: string; minutes: number; intervals: string | null; settings: string | null; targetEffort: string } | null;
    }
  >();

  if (plan) {
    plan.blocks.forEach((block) => {
      block.exercises.forEach((ex) => {
        plannedExercisesByName.set(ex.name, {
          block: block.block,
          name: ex.name,
          unit: ex.unit,
          sets: ex.sets,
          cardio: ex.cardio,
        });
      });
    });
  }

  // Top section: review summary and highlights if exists
  if (review) {
    return (
      <div>
        {review.summary && (
          <div className="mb-4">
            <p className="text-sm text-[var(--color-text)] font-medium">{review.summary}</p>
          </div>
        )}
        {review.highlights.length > 0 && (
          <div className="mb-6">
            <ul className="space-y-1">
              {review.highlights.map((highlight, i) => (
                <li key={i} className="text-sm text-[var(--color-text-muted)]">
                  • {highlight}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {session.exercises.map((ex) => (
            <ExerciseCard key={ex.id} session={session} exercise={ex} plannedExercisesByName={plannedExercisesByName} plan={plan} />
          ))}

          {/* Planned exercises not in actual */}
          {plan &&
            Array.from(plannedExercisesByName.values()).map((planned) => {
              const found = session.exercises.some(
                (e) => e.name === planned.name || e.swappedFrom === planned.name
              );
              if (found) return null;
              return (
                <div key={planned.name} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
                  <div className="text-sm text-[var(--color-text-muted)]">Not done: {planned.name}</div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  // No review: just show actual exercises
  return (
    <div className="space-y-4">
      {session.exercises.map((ex) => (
        <ExerciseCard key={ex.id} session={session} exercise={ex} plannedExercisesByName={plannedExercisesByName} plan={plan} />
      ))}
    </div>
  );
}

interface ExerciseCardProps {
  session: ApiSession;
  exercise: ApiExercise;
  plannedExercisesByName: Map<string, any>;
  plan: any;
}

function ExerciseCard({ session, exercise, plannedExercisesByName, plan }: ExerciseCardProps) {
  // Find planned exercise
  const plannedExercise =
    plannedExercisesByName.get(exercise.name) || plannedExercisesByName.get(exercise.swappedFrom || "");

  // Compute badges
  const badges: Array<{ label: string; color: string }> = [];

  if (exercise.skipped) {
    badges.push({
      label: `Skipped (${exercise.skipReason || "other"})`,
      color: "bg-red-500/10 text-red-700 dark:text-red-300",
    });
  }
  if (exercise.added) {
    badges.push({
      label: "Added",
      color: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    });
  }
  if (exercise.swappedFrom) {
    badges.push({
      label: `Swapped from ${exercise.swappedFrom}`,
      color: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    });
  }

  // Compare weights if plan exists
  if (plannedExercise && !exercise.skipped) {
    const plannedWorkingSets = plannedExercise.sets.filter((s: any) => s.setType === "working");
    const actualWorkingSets = exercise.sets.filter((s: any) => s.setType === "working");

    if (plannedWorkingSets.length > 0 && actualWorkingSets.length > 0) {
      const plannedMaxWeight = Math.max(...plannedWorkingSets.map((s: any) => s.weight || 0));
      const actualMaxWeight = Math.max(...actualWorkingSets.map((s: any) => s.weightLbs || 0));

      if (actualMaxWeight > plannedMaxWeight) {
        badges.push({
          label: "Heavier",
          color: "bg-green-500/10 text-green-700 dark:text-green-300",
        });
      } else if (actualMaxWeight < plannedMaxWeight) {
        badges.push({
          label: "Lighter",
          color: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        });
      }
    }

    // Compare set counts
    if (plannedWorkingSets.length !== actualWorkingSets.length) {
      badges.push({
        label: `${actualWorkingSets.length}/${plannedWorkingSets.length} sets`,
        color: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
      });
    }
  }

  const plannedCardio = plan && exercise ? plannedCardioFor(session, exercise) : null;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-[var(--color-text)]">{exercise.name}</h3>
        {exercise.muscleGroups && (
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{exercise.muscleGroups}</p>
        )}
      </div>

      {!exercise.skipped && (plannedExercise || exercise.sets.length > 0 || exercise.cardio.length > 0) && (
        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          {plannedExercise && (
            <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-2">
              <p className="text-xs text-[var(--color-text-faint)] font-semibold mb-1">Planned</p>
              {plannedExercise.sets.length > 0 && (
                <div className="space-y-0.5 text-xs text-[var(--color-text)]">
                  {plannedExercise.sets.map((s: any, i: number) => (
                    <div key={i}>
                      {s.setType === "ramp" && <span className="text-[var(--color-text-faint)]">Ramp: </span>}
                      {s.reps ? (
                        <span>
                          {s.reps} ×{" "}
                          {loadText(plannedExercise.unit, s.weight)}
                        </span>
                      ) : (
                        loadText(plannedExercise.unit, s.weight)
                      )}
                      {s.targetRir != null && s.setType === "working" && (
                        <span> · RIR {s.targetRir}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {plannedCardio && (
                <div className="text-xs text-[var(--color-text)] mt-1">
                  {plannedCardio.machine}: {plannedCardio.minutes} min
                  {plannedCardio.intervals && <div className="text-[var(--color-text-faint)]">{plannedCardio.intervals}</div>}
                </div>
              )}
            </div>
          )}

          <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-2">
            <p className="text-xs text-[var(--color-text-faint)] font-semibold mb-1">Actual</p>
            {exercise.sets.length > 0 && (
              <div className="space-y-0.5 text-xs text-[var(--color-text)]">
                {exercise.sets.map((s) => (
                  <div key={s.id}>
                    {s.setType === "abandoned" ? (
                      <span className="text-[var(--color-text-faint)]">abandoned</span>
                    ) : (
                      <>
                        {s.weightLbs !== null ? `${s.weightLbs} ` : ""}×{" "}
                        {s.reps ? `${s.reps}` : ""}
                        {s.rir != null && <span> · RIR {s.rir}</span>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            {exercise.cardio.length > 0 && (
              <div className="text-xs text-[var(--color-text)] mt-1 space-y-1">
                {exercise.cardio.map((c) => (
                  <div key={c.id}>
                    {c.machine}: {c.minutes} min
                    {c.heartRate && <div className="text-[var(--color-text-faint)]">HR {c.heartRate}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((badge, i) => (
            <span key={i} className={`inline-block text-xs px-2 py-1 rounded ${badge.color}`}>
              {badge.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
