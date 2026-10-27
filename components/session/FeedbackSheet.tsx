"use client";
import { useState, useCallback } from "react";
import { Sheet, btn, btnAccent, chipOn } from "./ui";

type FeedbackTag = "felt_great" | "too_easy" | "too_hard" | "joint_discomfort" | "disliked" | "equipment_issue";

const TAG_LABELS: Record<FeedbackTag, string> = {
  felt_great: "Felt great",
  too_easy: "Too easy",
  too_hard: "Too hard",
  joint_discomfort: "Joint discomfort",
  disliked: "Didn't like it",
  equipment_issue: "Equipment issue",
};

interface FeedbackResponse {
  id: string;
  coachReply?: string;
  substitutes?: string[];
  offerDislike?: {
    exerciseName: string;
  };
}

export default function FeedbackSheet(props: {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  initialTag?: string;
  onTagged: (tag: string) => void;
  onSwap: (substitute: string) => void;
  onClose: () => void;
}) {
  const [selectedTags, setSelectedTags] = useState<FeedbackTag[]>(
    props.initialTag ? [props.initialTag as FeedbackTag] : []
  );
  const [painLocation, setPainLocation] = useState("");
  const [painSharp, setPainSharp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<FeedbackResponse | null>(null);
  const [error, setError] = useState(false);
  const [offerDislikeDone, setOfferDislikeDone] = useState(false);

  const handleTagToggle = useCallback((tag: FeedbackTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleSend = useCallback(async () => {
    if (selectedTags.length === 0) return;
    setSubmitting(true);
    setError(false);

    try {
      const body: {
        tags: FeedbackTag[];
        painLocation?: string;
        painSharp?: boolean;
        note?: string;
      } = {
        tags: selectedTags,
      };

      if (selectedTags.includes("joint_discomfort")) {
        if (painLocation) body.painLocation = painLocation;
        body.painSharp = painSharp;
      }

      const res = await fetch(
        `/api/sessions/${props.sessionId}/exercises/${props.exerciseId}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: FeedbackResponse = await res.json();
      setResponse(data);
      selectedTags.forEach((tag) => props.onTagged(tag));
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }, [selectedTags, painLocation, painSharp, props]);

  const handleSwap = useCallback(
    (substitute: string) => {
      props.onSwap(substitute);
      props.onClose();
    },
    [props]
  );

  const handleNeverAgain = useCallback(async () => {
    if (!response?.offerDislike) return;
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseName: response.offerDislike.exerciseName,
          kind: "disliked",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOfferDislikeDone(true);
    } catch (e) {
      console.error("Failed to save preference:", e);
    }
  }, [response?.offerDislike]);

  return (
    <Sheet title={`How is ${props.exerciseName}?`} onClose={props.onClose}>
      {response ? (
        <div className="space-y-4">
          {response.coachReply && (
            <div className="border-2 border-[var(--color-accent)] rounded-xl p-3 bg-[var(--color-surface)]">
              <p className="text-base text-[var(--color-text)]">
                {response.coachReply}
              </p>
            </div>
          )}

          {response.substitutes && response.substitutes.length > 0 && (
            <div className="space-y-2">
              {response.substitutes.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`${btnAccent} w-full text-base`}
                  onClick={() => handleSwap(name)}
                >
                  Swap to {name}
                </button>
              ))}
            </div>
          )}

          {response.offerDislike && !offerDislikeDone && (
            <div className="border border-[var(--color-border)] rounded-xl p-3 bg-[var(--color-surface)]">
              <p className="text-sm font-semibold text-[var(--color-text)] mb-3">
                Never program {response.offerDislike.exerciseName} again?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`${btnAccent} flex-1`}
                  onClick={handleNeverAgain}
                >
                  Yes, never again
                </button>
                <button
                  type="button"
                  className={`${btn} flex-1`}
                  onClick={() => setOfferDislikeDone(true)}
                >
                  Not now
                </button>
              </div>
            </div>
          )}

          {offerDislikeDone && response.offerDislike && (
            <div className="text-center text-sm text-[var(--color-text-muted)]">
              Saved.
            </div>
          )}

          <button
            type="button"
            className={`${btn} w-full text-base mt-4`}
            onClick={props.onClose}
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="text-sm text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-2">
              Couldn't send — try again
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TAG_LABELS) as FeedbackTag[]).map((tag) => (
              <button
                key={tag}
                type="button"
                className={`${btn} text-sm min-h-[48px] ${
                  selectedTags.includes(tag) ? chipOn : ""
                }`}
                onClick={() => handleTagToggle(tag)}
              >
                {TAG_LABELS[tag]}
              </button>
            ))}
          </div>

          {selectedTags.includes("joint_discomfort") && (
            <div className="space-y-3 pt-2">
              <input
                type="text"
                placeholder="Where? (e.g. left shoulder)"
                value={painLocation}
                onChange={(e) => setPainLocation(e.target.value)}
                className="w-full text-base border border-[var(--color-border)] rounded-lg px-3 py-2 min-h-[48px] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 text-sm ${btn} ${
                    painSharp ? chipOn : ""
                  }`}
                  onClick={() => setPainSharp(true)}
                >
                  Sharp pain
                </button>
                <button
                  type="button"
                  className={`flex-1 text-sm ${btn} ${
                    !painSharp ? chipOn : ""
                  }`}
                  onClick={() => setPainSharp(false)}
                >
                  No sharp pain
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className={`${btnAccent} w-full min-h-[56px] text-base mt-2`}
            disabled={selectedTags.length === 0 || submitting}
            onClick={handleSend}
          >
            {submitting ? "Sending..." : "Send"}
          </button>
        </div>
      )}
    </Sheet>
  );
}
