"use client";

import { useState, useEffect, useRef } from "react";

interface AIReview {
  id: string;
  createdAt: string;
  reviewText: string;
  category: string;
}

export default function AIReviewPage() {
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [history, setHistory] = useState<AIReview[]>([]);
  const [error, setError] = useState("");
  const [selectedReview, setSelectedReview] = useState<AIReview | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  const loadHistory = () =>
    fetch("/api/ai/review")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHistory(data);
      });

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamText]);

  const handleReview = async () => {
    setStreaming(true);
    setStreamText("");
    setSelectedReview(null);
    setError("");

    try {
      const res = await fetch("/api/ai/review", { method: "POST" });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong.");
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setStreamText((prev) => prev + decoder.decode(value, { stream: true }));
      }

      await loadHistory();
    } catch {
      setError("Failed to connect. Make sure ANTHROPIC_API_KEY is set in .env.local.");
    }

    setStreaming(false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  const displayText = selectedReview ? selectedReview.reviewText : streamText;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">AI Review</h2>
      <p className="text-slate-500 text-sm mb-8">
        Claude analyzes your entire plan — profile, workout frequency, exercise selection, and nutrition — and flags anything that doesn&apos;t match your goals.
      </p>

      <div className="flex gap-8">
        {/* Main review area */}
        <div className="flex-1">
          <button
            onClick={handleReview}
            disabled={streaming}
            className="w-full mb-6 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {streaming ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing your plan...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Run AI Review
              </>
            )}
          </button>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
              {error}
            </div>
          )}

          {displayText && (
            <div
              ref={streamRef}
              className="bg-white rounded-2xl border border-slate-200 p-6 prose prose-sm prose-slate max-w-none overflow-y-auto max-h-[600px]"
              style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
            >
              {displayText}
              {streaming && <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-middle" />}
            </div>
          )}

          {!displayText && !streaming && !error && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-sm">Run a review to get Claude&apos;s analysis of your plan.</p>
              <p className="text-xs mt-1 opacity-70">Requires a profile, workout plan, and ANTHROPIC_API_KEY</p>
            </div>
          )}
        </div>

        {/* History sidebar */}
        {history.length > 0 && (
          <div className="w-52 shrink-0">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Past Reviews</h3>
            <div className="space-y-2">
              {history.map((review) => (
                <button
                  key={review.id}
                  onClick={() => setSelectedReview(selectedReview?.id === review.id ? null : review)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                    selectedReview?.id === review.id
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <p className="font-medium">{formatDate(review.createdAt)}</p>
                  <p className="text-slate-400 mt-0.5 line-clamp-2">{review.reviewText.slice(0, 60)}...</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
