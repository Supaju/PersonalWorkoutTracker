import Link from "next/link";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { TEMPLATES, TEMPLATE_COLORS, type TemplateId } from "@/lib/templates";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await db.workoutSession.findUnique({
    where: { id },
    include: { exercises: { include: { sets: { orderBy: { setNumber: "asc" } } }, orderBy: { orderIndex: "asc" } } },
  });

  if (!session) notFound();

  const label = TEMPLATES[session.template as TemplateId]?.label ?? session.template;
  const colorClass = TEMPLATE_COLORS[session.template as TemplateId] ?? "bg-[var(--color-surface)] text-[var(--color-text-muted)]";
  const totalVolume = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.reduce((a, s) => a + s.weightLbs * s.reps, 0),
    0
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-2xl font-bold text-[var(--color-text)] uppercase tracking-wide">{label}</h2>
        <span className={`text-xs font-bold px-3 py-1 ${colorClass}`}>{session.date}</span>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase tracking-wider ${session.phase === "recorded" ? "bg-[#0a1a0a] text-[#86efac]" : "bg-[#1a1000] text-[#fdba74]"}`}>
          {session.phase === "recorded" ? "Recorded" : "Planned"}
        </span>
      </div>

      <div className="flex gap-4 text-sm text-[var(--color-text-faint)] mb-8">
        {session.durationMin && <span>{session.durationMin} min</span>}
        {totalVolume > 0 && <span>{Math.round(totalVolume).toLocaleString()} lbs total volume</span>}
        {session.phase === "planned" && (
          <Link href={`/sessions/${session.id}/record`} className="text-[var(--color-accent)] font-medium hover:underline">
            Record this session →
          </Link>
        )}
      </div>

      {session.notes && (
        <div className="bg-[#110a1a] border border-[#2a1a3a] p-4 mb-6">
          <p className="text-xs font-bold text-[#c4b5fd] mb-1 uppercase tracking-widest">Coach Notes</p>
          <p className="text-sm text-[#c4b5fd]">{session.notes}</p>
        </div>
      )}

      <div className="space-y-4">
        {session.exercises.map((ex) => (
          <div key={ex.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-bold text-[var(--color-text)]">{ex.name}</h3>
              <span className="text-xs text-[var(--color-text-faint)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-0.5">{ex.muscleGroups}</span>
            </div>
            <p className="text-xs text-[var(--color-text-faint)] mb-3">Target: {ex.targetSets} sets × {ex.targetReps} reps{ex.targetWeight ? ` @ ${ex.targetWeight} lbs` : ""}</p>

            {ex.aiNotes && <p className="text-xs text-[var(--color-text-faint)] italic mb-3">{ex.aiNotes}</p>}

            {ex.sets.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {ex.sets.map((s) => (
                  <div key={s.id} className="text-center bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 min-w-[60px]">
                    <p className="text-xs text-[var(--color-text-faint)] uppercase tracking-wider">Set {s.setNumber}</p>
                    <p className="font-bold text-[var(--color-text)] text-sm">{s.weightLbs}<span className="text-xs font-normal"> lbs</span></p>
                    <p className="text-xs text-[var(--color-text-muted)]">{s.reps} reps</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-faint)]">No sets recorded yet.</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link href="/sessions" className="text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)]">← Back to sessions</Link>
      </div>
    </div>
  );
}
