"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { RecordedCompare } from "@/components/session/RecordedCompare";
import PlannedSessionView from "@/components/session/PlannedSessionView";
import { sessionLabel, type ApiSession } from "@/components/session/types";

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await globalThis.fetch(`/api/sessions/${id}`);
        if (res.status === 404) {
          setNotFound(true);
        } else if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        } else {
          const data = await res.json();
          setSession(data);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-[var(--color-surface)] rounded-xl animate-pulse w-1/2" />
        <div className="h-40 bg-[var(--color-surface)] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-faint)] mb-4">Session not found</p>
        <Link href="/sessions" className="text-[var(--color-accent)] hover:underline text-sm">
          ← Back to sessions
        </Link>
      </div>
    );
  }

  const dateObj = new Date(`${session.date}T00:00:00`);
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (session.phase === "recorded") {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[var(--color-text)] uppercase tracking-wide mb-2">
            {session.name || sessionLabel(session.sessionType)}
          </h2>
          <p className="text-sm text-[var(--color-text-faint)]">{formattedDate}</p>
        </div>

        {session.durationMin && (
          <p className="text-sm text-[var(--color-text-faint)] mb-6">
            {session.durationMin} min
          </p>
        )}

        <div className="flex flex-col gap-2 mb-6">
          <Link
            href={`/sessions/${id}/record`}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium text-sm hover:opacity-90 transition-opacity text-center"
          >
            Edit / add sets
          </Link>
          <Link
            href={`/sessions/${id}/print`}
            className="min-h-[48px] px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] font-medium text-sm hover:border-[var(--color-accent)] transition-colors text-center"
          >
            Print sheet
          </Link>
        </div>

        <RecordedCompare session={session} />

        <div className="mt-8">
          <Link href="/sessions" className="text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)]">
            ← Back to sessions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[var(--color-text)] uppercase tracking-wide mb-2">
          {session.name || sessionLabel(session.sessionType)}
        </h2>
        <p className="text-sm text-[var(--color-text-faint)]">{formattedDate}</p>
      </div>

      {session.durationMin && (
        <p className="text-sm text-[var(--color-text-faint)] mb-6">
          {session.durationMin} min
        </p>
      )}

      <PlannedSessionView session={session} />

      <div className="mt-8">
        <Link href="/sessions" className="text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)]">
          ← Back to sessions
        </Link>
      </div>
    </div>
  );
}
