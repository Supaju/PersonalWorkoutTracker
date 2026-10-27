"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import WeekView from "@/components/session/WeekView";

interface TodayResponse {
  activeSession: { id: string; date: string; sessionType: string; name: string | null } | null;
  plannedSession: { id: string; date: string; sessionType: string; name: string | null } | null;
}

export default function TodayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToday = async () => {
      try {
        const res = await fetch("/api/today");
        if (!res.ok) throw new Error("Failed to fetch today's session");
        const data: TodayResponse = await res.json();

        if (data.activeSession) {
          router.replace(`/sessions/${data.activeSession.id}/record`);
          return;
        }
        if (data.plannedSession) {
          router.replace(`/sessions/${data.plannedSession.id}`);
          return;
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setLoading(false);
      }
    };

    fetchToday();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-[var(--color-text)]">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <WeekView />

      <div className="mt-8 flex flex-col items-center justify-center py-16">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 max-w-sm text-center">
          <p className="text-[var(--color-text)] font-medium mb-6">No plan yet — ask your coach</p>
          <Link
            href="/"
            className="btn-accent text-sm inline-flex min-h-[48px] items-center"
          >
            Go to coach
          </Link>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/sessions/new"
          className="text-[var(--color-accent)] hover:underline text-sm"
        >
          Log a past workout
        </Link>
      </div>
    </div>
  );
}
