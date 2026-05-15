"use client";

import { useState, useRef, useEffect } from "react";
import type { PlannedExercise, Message } from "@/lib/types";
import type { TemplateId } from "@/lib/templates";

type Props = {
  open: boolean;
  template: TemplateId;
  currentExercises: PlannedExercise[];
  initialPlanJson: string;
  onApply: (exercises: PlannedExercise[], messages: Message[]) => void;
  onClose: () => void;
};

function isChanged(a: PlannedExercise, b: PlannedExercise): boolean {
  return (
    a.name !== b.name ||
    a.targetSets !== b.targetSets ||
    a.targetReps !== b.targetReps ||
    a.targetWeight !== b.targetWeight
  );
}

function changedFields(a: PlannedExercise, b: PlannedExercise): Set<string> {
  const fields = new Set<string>();
  if (a.name !== b.name) fields.add("name");
  if (a.targetSets !== b.targetSets) fields.add("targetSets");
  if (a.targetReps !== b.targetReps) fields.add("targetReps");
  if (a.targetWeight !== b.targetWeight) fields.add("targetWeight");
  return fields;
}

export function PlanReviseDrawer({
  open,
  template,
  currentExercises,
  initialPlanJson,
  onApply,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposedExercises, setProposedExercises] = useState<PlannedExercise[] | null>(null);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, proposedExercises]);

  const send = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText("");
    setError("");
    setSending(true);

    const newUserMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);

    try {
      const res = await fetch("/api/sessions/plan/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          currentExercises,
          initialPlanJson,
          messages,
          userMessage: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to get revision.");
        setMessages(messages);
        return;
      }
      const assistantMessage: Message = { role: "assistant", content: data.reply };
      setMessages([...updatedMessages, assistantMessage]);
      setProposedExercises(data.exercises);
    } catch {
      setError("Failed to connect.");
      setMessages(messages);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const acceptAll = () => {
    if (!proposedExercises) return;
    onApply(proposedExercises, messages);
    setProposedExercises(null);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-[480px] max-w-full bg-[var(--color-bg)] border-l border-[var(--color-border)] z-50 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-widest">
            Revise with AI
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {messages.length === 0 && (
            <p className="text-[var(--color-text-faint)] text-sm text-center mt-8 leading-relaxed">
              Tell Claude what to change.<br />
              <span className="text-xs opacity-70">
                e.g. "swap bench press for incline dumbbell" or "the row weight feels too high"
              </span>
            </p>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[var(--color-surface)] border border-[var(--color-accent)] text-[var(--color-text)]"
                    : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Diff table */}
          {proposedExercises && (
            <div className="mt-2">
              <p className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-2">
                Proposed Changes
              </p>
              <div className="border border-[var(--color-border)] overflow-hidden text-xs">
                {proposedExercises.map((proposed, i) => {
                  const current = currentExercises[i];
                  const isNew = !current;
                  const changed = !isNew && isChanged(current!, proposed);
                  const fields = changed ? changedFields(current!, proposed) : new Set<string>();
                  return (
                    <div
                      key={i}
                      className={`px-3 py-2.5 border-b border-[var(--color-border)] last:border-0 ${
                        isNew
                          ? "border-l-2 border-l-green-500 bg-[var(--color-surface)]"
                          : changed
                          ? "border-l-2 border-l-amber-500 bg-[var(--color-surface)]"
                          : "opacity-40"
                      }`}
                    >
                      <span className={isNew ? "font-bold text-green-400" : fields.has("name") ? "font-bold text-amber-400" : "text-[var(--color-text)]"}>
                        {proposed.name}
                      </span>
                      {isNew && <span className="ml-2 text-xs font-bold text-green-400 uppercase tracking-wider">NEW</span>}
                      <span className="text-[var(--color-text-faint)] ml-3">
                        <span className={!isNew && fields.has("targetSets") ? "font-bold text-amber-400" : ""}>
                          {proposed.targetSets}
                        </span>
                        {" × "}
                        <span className={!isNew && fields.has("targetReps") ? "font-bold text-amber-400" : ""}>
                          {proposed.targetReps}
                        </span>
                        {" @ "}
                        <span
                          className={!isNew && fields.has("targetWeight") ? "font-bold text-amber-400" : ""}
                        >
                          {proposed.targetWeight != null ? `${proposed.targetWeight} lbs` : "BW"}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={acceptAll} className="btn-accent">
                  Accept All Changes
                </button>
                <button
                  onClick={() => setProposedExercises(null)}
                  className="px-4 py-2 text-xs border border-[var(--color-border)] text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)] transition-colors uppercase tracking-widest font-bold"
                >
                  Keep Current
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-2 bg-[#1a0505] border-t border-[#3a1010] text-[#f87171] text-xs shrink-0">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] shrink-0">
          <div className="flex gap-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder="Tell Claude what to change..."
              rows={2}
              className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-accent)] resize-none disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={sending || !inputText.trim()}
              aria-label="Send message"
              className="btn-accent px-4 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-faint)] mt-1.5">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}
