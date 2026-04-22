import Link from "next/link";
import { db } from "@/lib/db";
import { TEMPLATES, TEMPLATE_COLORS, type TemplateId } from "@/lib/templates";

export default async function SessionsPage() {
  const sessions = await db.workoutSession.findMany({
    include: { exercises: { include: { sets: true }, orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-slate-900">Sessions</h2>
        <Link
          href="/sessions/plan"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Plan Next Session
        </Link>
      </div>
      <p className="text-slate-500 text-sm mb-8">Your full training history.</p>

      {sessions.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-sm mb-3">No sessions yet.</p>
          <Link href="/sessions/plan" className="text-indigo-600 hover:underline text-sm">
            Plan your first session →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const label = TEMPLATES[session.template as TemplateId]?.label ?? session.template;
            const colorClass = TEMPLATE_COLORS[session.template as TemplateId] ?? "bg-slate-100 text-slate-700";
            const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);

            return (
              <Link
                key={session.id}
                href={
                  session.phase === "planned"
                    ? `/sessions/${session.id}/record`
                    : `/sessions/${session.id}`
                }
                className="block bg-white rounded-2xl border border-slate-200 px-6 py-4 hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colorClass}`}>
                      {label}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{session.date}</span>
                    {session.durationMin && (
                      <span className="text-xs text-slate-400">{session.durationMin} min</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400">
                      {session.exercises.length} exercises · {totalSets} sets logged
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                        session.phase === "recorded"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {session.phase === "recorded" ? "Recorded" : "Planned"}
                    </span>
                  </div>
                </div>

                {session.exercises.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {session.exercises.slice(0, 4).map((ex) => (
                      <span key={ex.id} className="text-xs text-slate-500 bg-slate-50 rounded-md px-2 py-1">
                        {ex.name}
                      </span>
                    ))}
                    {session.exercises.length > 4 && (
                      <span className="text-xs text-slate-400">+{session.exercises.length - 4} more</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
