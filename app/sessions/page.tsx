import Link from "next/link";
import { db } from "@/lib/db";
import { TEMPLATES, TEMPLATE_COLORS, type TemplateId } from "@/lib/templates";
import { DeleteSessionButton } from "./DeleteSessionButton";

export default async function SessionsPage() {
  const sessions = await db.workoutSession.findMany({
    include: { exercises: { include: { sets: true }, orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-[var(--color-text)] uppercase tracking-wide">Sessions</h2>
        <Link
          href="/sessions/plan"
          className="btn-accent text-xs"
        >
          Plan Next Session
        </Link>
      </div>
      <p className="text-[var(--color-text-faint)] text-sm mb-8 uppercase tracking-widest">Your full training history.</p>

      {sessions.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-text-faint)]">
          <p className="text-sm mb-3">No sessions yet.</p>
          <Link href="/sessions/plan" className="text-[var(--color-accent)] hover:underline text-sm">
            Plan your first session →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const label = TEMPLATES[session.template as TemplateId]?.label ?? session.template;
            const colorClass = TEMPLATE_COLORS[session.template as TemplateId] ?? "bg-[var(--color-surface)] text-[var(--color-text-muted)]";
            const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
            const href = session.phase === "planned"
              ? `/sessions/${session.id}/record`
              : `/sessions/${session.id}`;

            return (
              <div
                key={session.id}
                className="group bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
              >
                <Link href={href} className="block px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2.5 py-1 ${colorClass}`}>
                        {label}
                      </span>
                      <span className="text-sm font-medium text-[var(--color-text)]">{session.date}</span>
                      {session.durationMin && (
                        <span className="text-xs text-[var(--color-text-faint)]">{session.durationMin} min</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-[var(--color-text-faint)]">
                        {session.exercises.length} exercises · {totalSets} sets logged
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 uppercase tracking-wider ${
                          session.phase === "recorded"
                            ? "bg-[#0a1a0a] text-[#86efac]"
                            : "bg-[#1a1000] text-[#fdba74]"
                        }`}
                      >
                        {session.phase === "recorded" ? "Recorded" : "Planned"}
                      </span>
                    </div>
                  </div>

                  {session.exercises.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {session.exercises.slice(0, 4).map((ex) => (
                        <span key={ex.id} className="text-xs text-[var(--color-text-faint)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1">
                          {ex.name}
                        </span>
                      ))}
                      {session.exercises.length > 4 && (
                        <span className="text-xs text-[var(--color-text-faint)]">+{session.exercises.length - 4} more</span>
                      )}
                    </div>
                  )}
                </Link>

                <div className="flex justify-end px-4 pb-3 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DeleteSessionButton id={session.id} phase={session.phase} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
