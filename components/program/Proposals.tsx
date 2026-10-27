"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Structure } from "@/components/coach/types";
import { api, sessionLabel } from "@/components/coach/types";

export type ProposalRow = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "superseded";
  observations: string; // JSON string[]
  recommendation: string;
  rationale: string;
  tradeOffs: string;
  weekToWeek: string;
  structure: string; // JSON Structure
  clientResponse: string | null;
  createdAt: string;
  decidedAt: string | null;
};

interface ProposalsProps {
  proposals: ProposalRow[];
}

export default function Proposals({ proposals }: ProposalsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  const pending = proposals.filter((p) => p.status === "pending");
  const past = proposals.filter((p) => p.status !== "pending");

  const parseJSON = <T,>(json: string): T | null => {
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  };

  const handleAccept = async (id: string) => {
    setBusy(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      await api(`/api/proposals/${id}`, { decision: "accept" });
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept proposal";
      setErrors((prev) => ({ ...prev, [id]: msg }));
      setBusy(null);
    }
  };

  const handleReject = async (id: string) => {
    setBusy(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      await api(`/api/proposals/${id}`, {
        decision: "reject",
        response: rejectReason || undefined,
      });
      setRejectId(null);
      setRejectReason("");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reject proposal";
      setErrors((prev) => ({ ...prev, [id]: msg }));
      setBusy(null);
    }
  };

  const handleReview = async () => {
    setReviewBusy(true);
    setErrors((prev) => ({ ...prev, review: "" }));
    try {
      const res = await api<{ proposalId: string | null; reason?: string }>(
        "/api/program/review",
        {},
        "POST"
      );
      if (res.proposalId) {
        router.refresh();
      } else if (res.reason) {
        setErrors((prev) => ({ ...prev, review: res.reason || "" }));
        setReviewBusy(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Review request failed";
      setErrors((prev) => ({ ...prev, review: msg }));
      setReviewBusy(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const isBusyThisCard = (id: string) => busy === id;

  return (
    <div className="space-y-4">
      {/* Request review button */}
      <button
        onClick={handleReview}
        disabled={reviewBusy}
        className="btn-ghost w-full"
      >
        {reviewBusy ? "Reviewing…" : "Request a program review"}
      </button>
      {errors.review && <p className="text-red-500 text-sm">{errors.review}</p>}

      {/* No proposals */}
      {proposals.length === 0 && (
        <p className="text-muted">No proposals yet.</p>
      )}

      {/* Pending proposals */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="label">Program proposals</p>
          {pending.map((proposal) => {
            const obs = parseJSON<string[]>(proposal.observations) ?? [];
            const struct = parseJSON<Structure>(proposal.structure);

            return (
              <div key={proposal.id} className="card p-4 space-y-3">
                {/* Recommendation */}
                <p className="text-lg font-semibold">{proposal.recommendation}</p>

                {/* Observations */}
                {obs.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">What I'm seeing</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {obs.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Rationale */}
                <div>
                  <p className="text-sm font-medium mb-1">Why</p>
                  <p className="text-sm">{proposal.rationale}</p>
                </div>

                {/* Week to week */}
                <div>
                  <p className="text-sm font-medium mb-1">Week to week</p>
                  <p className="text-sm">{proposal.weekToWeek}</p>
                </div>

                {/* Trade-offs */}
                <div>
                  <p className="text-sm font-medium mb-1">Trade-offs</p>
                  <p className="text-sm">{proposal.tradeOffs}</p>
                </div>

                {/* New structure */}
                {struct && (
                  <p className="text-sm text-muted">
                    New structure: {struct.phase} — rotation {struct.rotation.map(sessionLabel).join(" / ")}
                  </p>
                )}

                {/* Error message */}
                {errors[proposal.id] && (
                  <p className="text-red-500 text-sm">{errors[proposal.id]}</p>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap">
                  <button
                    onClick={() => handleAccept(proposal.id)}
                    disabled={isBusyThisCard(proposal.id)}
                    className="btn-accent min-h-[44px] flex-1 sm:flex-initial"
                  >
                    Accept
                  </button>

                  {rejectId === proposal.id ? (
                    <>
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="input min-h-[44px] flex-1 sm:flex-initial"
                      />
                      <button
                        onClick={() => handleReject(proposal.id)}
                        disabled={isBusyThisCard(proposal.id)}
                        className="btn-ghost min-h-[44px] flex-1 sm:flex-initial"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setRejectId(proposal.id)}
                      disabled={isBusyThisCard(proposal.id)}
                      className="btn-ghost min-h-[44px] flex-1 sm:flex-initial"
                    >
                      Reject
                    </button>
                  )}

                  <button
                    onClick={() =>
                      router.push(
                        `/?prefill=${encodeURIComponent(
                          `I want to talk about your proposal: ${proposal.recommendation}`
                        )}`
                      )
                    }
                    disabled={isBusyThisCard(proposal.id)}
                    className="btn-ghost min-h-[44px] flex-1 sm:flex-initial"
                  >
                    Discuss with coach
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Past proposals */}
      {past.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer font-medium">Past proposals</summary>
          <div className="space-y-2 pl-2">
            {past.map((proposal) => (
              <div key={proposal.id} className="text-sm space-y-1">
                <p className="font-medium">
                  {proposal.status} · {formatDate(proposal.createdAt)} · {proposal.recommendation}
                </p>
                {proposal.clientResponse && (
                  <p className="text-muted text-xs">{proposal.clientResponse}</p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
