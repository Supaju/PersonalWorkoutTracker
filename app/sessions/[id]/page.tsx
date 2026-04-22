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
  const colorClass = TEMPLATE_COLORS[session.template as TemplateId] ?? "bg-slate-100 text-slate-700";
  const totalVolume = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.reduce((a, s) => a + s.weightLbs * s.reps, 0),
    0
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-2xl font-bold text-slate-900">{label}</h2>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${colorClass}`}>{session.date}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${session.phase === "recorded" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {session.phase === "recorded" ? "Recorded" : "Planned"}
        </span>
      </div>

      <div className="flex gap-4 text-sm text-slate-500 mb-8">
        {session.durationMin && <span>{session.durationMin} min</span>}
        {totalVolume > 0 && <span>{Math.round(totalVolume).toLocaleString()} lbs total volume</span>}
        {session.phase === "planned" && (
          <Link href={`/sessions/${session.id}/record`} className="text-indigo-600 font-medium hover:underline">
            Record this session →
          </Link>
        )}
      </div>

      {session.notes && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-indigo-700 mb-1">Coach Notes</p>
          <p className="text-sm text-indigo-800">{session.notes}</p>
        </div>
      )}

      <div className="space-y-4">
        {session.exercises.map((ex) => (
          <div key={ex.id} className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold text-slate-900">{ex.name}</h3>
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{ex.muscleGroups}</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">Target: {ex.targetSets} sets × {ex.targetReps} reps{ex.targetWeight ? ` @ ${ex.targetWeight} lbs` : ""}</p>

            {ex.aiNotes && <p className="text-xs text-slate-500 italic mb-3">{ex.aiNotes}</p>}

            {ex.sets.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {ex.sets.map((s) => (
                  <div key={s.id} className="text-center bg-slate-50 rounded-lg px-3 py-2 min-w-[60px]">
                    <p className="text-xs text-slate-400">Set {s.setNumber}</p>
                    <p className="font-semibold text-slate-800 text-sm">{s.weightLbs}<span className="text-xs font-normal"> lbs</span></p>
                    <p className="text-xs text-slate-600">{s.reps} reps</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No sets recorded yet.</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link href="/sessions" className="text-sm text-slate-500 hover:text-slate-700">← Back to sessions</Link>
      </div>
    </div>
  );
}
