"use client";
import { useState } from "react";
import type { SessionReview, ApiQuestion } from "@/components/session/types";
import { safeJson } from "@/components/session/types";
import { btn, btnAccent } from "./ui";

interface ProgressionState {
  exerciseName: string;
  nextWeight: number | null;
  nextReps: number | null;
  reason: string;
}

export default function ReviewPanel(props: {
  review: SessionReview;
  questions: ApiQuestion[];
  updating?: boolean;
  onDone?: () => void;
}) {
  const [progressions, setProgressions] = useState<ProgressionState[]>(
    props.review.progressions || []
  );
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(
    new Set(props.questions.filter((q) => q.answer != null).map((q) => q.id))
  );
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFreeText, setShowFreeText] = useState<string | null>(null);
  const [freeTextInput, setFreeTextInput] = useState("");

  const unanswered = props.questions.filter((q) => !answeredIds.has(q.id));

  const handleAnswer = async (questionId: string, answer: string) => {
    setSending(questionId);
    setError(null);

    try {
      const response = await fetch(`/api/questions/${questionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });

      if (!response.ok) {
        throw new Error("Failed to send answer");
      }

      const result = await response.json() as { progression: { exerciseName: string; nextWeight: number | null; reason: string } | null };

      // Mark as answered
      setAnsweredIds((prev) => new Set([...prev, questionId]));
      setSending(null);

      // Update progression if provided
      if (result.progression) {
        setProgressions((prev) => {
          const updated = prev.map((p) =>
            p.exerciseName === result.progression!.exerciseName
              ? { ...p, nextWeight: result.progression!.nextWeight, reason: result.progression!.reason }
              : p
          );
          return updated;
        });
      }
    } catch {
      setError("Couldn't send — try again");
      setSending(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 pb-8">
      {/* Summary */}
      {props.review.summary && (
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">
            {props.review.summary}
          </h1>
        </div>
      )}

      {/* Highlights */}
      {props.review.highlights && props.review.highlights.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">
            Highlights
          </h2>
          <ul className="space-y-1">
            {props.review.highlights.map((highlight, i) => (
              <li
                key={i}
                className="text-[var(--color-text)] leading-relaxed before:content-['•'] before:mr-2"
              >
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Time */}
      {progressions.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">
            Next time
          </h2>
          <ul className="space-y-2">
            {progressions.map((prog) => (
              <li key={prog.exerciseName} className="space-y-0.5">
                <div className="text-[var(--color-text)] font-medium">
                  {prog.exerciseName}
                  {prog.nextWeight != null && `: ${prog.nextWeight} lb`}
                  {prog.nextReps != null && ` × ${prog.nextReps}`}
                </div>
                {prog.reason && (
                  <div className="text-sm text-[var(--color-text-muted)]">
                    {prog.reason}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Decisions Needed */}
      {props.review.decisionsNeeded &&
        props.review.decisionsNeeded.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">
              Decisions needed
            </h2>
            <ul className="space-y-1">
              {props.review.decisionsNeeded.map((decision, i) => (
                <li
                  key={i}
                  className="text-[var(--color-text)] leading-relaxed before:content-['•'] before:mr-2"
                >
                  {decision}
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* Quick Questions */}
      {unanswered.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)] mb-3">
            Quick questions
          </h2>
          <div className="space-y-4">
            {unanswered.map((question) => {
              const options = safeJson<string[]>(question.options, []);
              const isAsking = showFreeText === question.id;

              return (
                <div key={question.id} className="border border-[var(--color-border)] rounded-xl p-3">
                  <div className="text-[var(--color-text)] font-medium mb-2">
                    {question.question}
                  </div>

                  {error && sending === question.id && (
                    <div className="text-sm text-red-500 mb-2">{error}</div>
                  )}

                  {options.length > 0 && !isAsking && (
                    <div className="flex flex-wrap gap-2">
                      {options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`${btn} px-3 py-2 text-sm flex-1 min-w-[100px]`}
                          onClick={() => handleAnswer(question.id, option)}
                          disabled={sending === question.id}
                        >
                          {option}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`${btn} px-3 py-2 text-sm flex-1 min-w-[100px]`}
                        onClick={() => {
                          setShowFreeText(question.id);
                          setFreeTextInput("");
                        }}
                        disabled={sending === question.id}
                      >
                        Something else…
                      </button>
                    </div>
                  )}

                  {isAsking && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-base"
                        placeholder="Type your answer…"
                        value={freeTextInput}
                        onChange={(e) => setFreeTextInput(e.target.value)}
                        style={{ fontSize: "16px" }}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={`${btn} px-3 py-2 text-sm flex-1`}
                          onClick={() => {
                            setShowFreeText(null);
                            setFreeTextInput("");
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className={`${btnAccent} px-3 py-2 text-sm flex-1`}
                          onClick={() => {
                            if (freeTextInput.trim()) {
                              handleAnswer(question.id, freeTextInput);
                              setShowFreeText(null);
                              setFreeTextInput("");
                            }
                          }}
                          disabled={sending === question.id || !freeTextInput.trim()}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}

                  {answeredIds.has(question.id) && !isAsking && (
                    <div className="text-sm text-[var(--color-text-muted)] mt-2">
                      Thanks — noted.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Updating note */}
      {props.updating && (
        <div className="text-sm text-[var(--color-text-muted)] text-center">
          Updating review…
        </div>
      )}

      {/* Done button */}
      {props.onDone && (
        <button
          type="button"
          className={`${btnAccent} w-full py-3 text-base font-bold mt-4`}
          onClick={props.onDone}
        >
          Done
        </button>
      )}
    </div>
  );
}
