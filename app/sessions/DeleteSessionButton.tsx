"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteSessionButton({ id, phase }: { id: string; phase: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
        <span className="text-xs text-[var(--color-text-muted)]">
          {phase === "recorded" ? "Delete session + all logged sets?" : "Delete planned session?"}
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs font-bold px-2.5 py-1 bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors uppercase tracking-wider"
        >
          {deleting ? "Deleting..." : "Confirm"}
        </button>
        <button
          onClick={handleCancel}
          className="text-xs px-2.5 py-1 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleDelete}
      className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors p-1"
      title="Delete session"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}
