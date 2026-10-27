import type { Structure, WeekDay } from "@/components/coach/types";
import { sessionLabel, DAY_NAMES } from "@/components/coach/types";

type Props = {
  version: { version: number; phase: string; reason: string; startDate: string; structure: string } | null;
  trainingDays: number[];
};

export default function CurrentProgram({ version, trainingDays }: Props) {
  if (!version) {
    return (
      <div className="card">
        <p className="text-[var(--color-text-muted)]">No program yet. The coach sets one up after your first sessions.</p>
      </div>
    );
  }

  let structure: Structure | null = null;
  try {
    structure = JSON.parse(version.structure);
  } catch {
    // fallback: show phase + reason only
  }

  const phasePretty = version.phase.replace(/_/g, " ");

  return (
    <div className="card space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">
          Current program · v{version.version}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{phasePretty}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{version.startDate}</p>
        {version.reason && (
          <p className="text-sm text-[var(--color-text-muted)] mt-2">{version.reason}</p>
        )}
      </div>

      {structure && (
        <>
          {/* Weekly layout */}
          {structure.rotation.length > 0 && trainingDays.length > 0 && (
            <div>
              <p className="label mb-2">Weekly layout</p>
              <div className="grid grid-cols-7 gap-1">
                {/* Mon..Sun: DAY_NAMES indices [1,2,3,4,5,6,0] */}
                {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                  const dayName = DAY_NAMES[dayIdx];
                  // Check if this day is a training day
                  const trainingIndex = trainingDays.indexOf(dayIdx);
                  const isTrainingDay = trainingIndex !== -1;
                  const rotation = structure.rotation[trainingIndex % structure.rotation.length];

                  return (
                    <div
                      key={dayIdx}
                      className="border border-[var(--color-border)] rounded p-2 text-center text-xs"
                    >
                      <p className="font-medium text-[var(--color-text)]">{dayName}</p>
                      {isTrainingDay ? (
                        <p className="text-[var(--color-text-muted)] text-[11px] mt-1 truncate">
                          {sessionLabel(rotation)}
                        </p>
                      ) : (
                        <p className="text-[var(--color-text-muted)] text-[11px] mt-1">Rest</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Session types */}
          {Object.keys(structure.sessionTypes).length > 0 && (
            <div>
              <p className="label mb-2">Session types</p>
              <div className="space-y-3">
                {Object.entries(structure.sessionTypes).map(([key, session]) => (
                  <div key={key}>
                    <p className="font-semibold text-sm">{session.label}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{session.focus}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {session.exercisePool.map((exercise) => (
                        <span
                          key={exercise}
                          className="text-[11px] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-muted)]"
                        >
                          {exercise}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progression */}
          {structure.progression && (
            <div>
              <p className="label mb-1">Progression</p>
              <p className="text-sm text-[var(--color-text-muted)]">{structure.progression}</p>
            </div>
          )}

          {/* Conditioning */}
          {structure.conditioning && (
            <div>
              <p className="label mb-1">Conditioning</p>
              <p className="text-sm text-[var(--color-text-muted)]">{structure.conditioning}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
