"use client";
import { useState } from "react";
import { btn, btnAccent, chipOn, Stepper, Choice, Sheet } from "./ui";

export interface CheckOutData {
  effort: number;                 // 1-10
  enjoyment: number;              // 1-5
  conditioning: "too_easy" | "about_right" | "too_hard" | null;
  painNotes: string | null;       // only when the user says something hurt
  note: string | null;
  bodyweightLbs: number | null;
}

export default function CheckOutSheet(props: {
  onSubmit: (d: CheckOutData) => void;
  onClose: () => void;
  busy: boolean;
  lastBodyweight?: number | null;
  hasConditioning: boolean;
}) {
  const [effort, setEffort] = useState<number | null>(null);
  const [enjoyment, setEnjoyment] = useState<number | null>(null);
  const [conditioning, setConditioning] = useState<"too_easy" | "about_right" | "too_hard" | null>(null);
  const [painResponse, setPainResponse] = useState<"no" | "yes" | null>("no");
  const [painNotes, setPainNotes] = useState("");
  const [note, setNote] = useState("");
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [bodyweightTouched, setBodyweightTouched] = useState(false);

  const handleBodyweightStep = (delta: number) => {
    setBodyweightTouched(true);
    const current = bodyweight ?? (props.lastBodyweight ?? 150);
    const newVal = current + delta;
    setBodyweight(Math.round(newVal * 10) / 10);
  };

  const handleSubmit = () => {
    if (effort === null || enjoyment === null) return;

    props.onSubmit({
      effort,
      enjoyment,
      conditioning,
      painNotes: painResponse === "yes" && painNotes.trim() ? painNotes.trim() : null,
      note: note.trim() || null,
      bodyweightLbs: bodyweightTouched ? bodyweight : null,
    });
  };

  const canSubmit = effort !== null && enjoyment !== null && !props.busy;

  return (
    <Sheet title="How did it go?" onClose={props.onClose}>
      <div className="space-y-5">
        {/* Effort */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-[var(--color-text)]">
            Effort (1 easy – 10 max)
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((e) => (
              <button
                key={e}
                type="button"
                className={`${btn} ${effort === e ? chipOn : ""}`}
                onClick={() => setEffort(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Enjoyment */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-[var(--color-text)]">
            Enjoyment
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((e) => (
              <button
                key={e}
                type="button"
                className={`${btn} ${enjoyment === e ? chipOn : ""}`}
                onClick={() => setEnjoyment(e)}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-2 text-center">
            hated it … loved it
          </div>
        </div>

        {/* Conditioning */}
        {props.hasConditioning && (
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--color-text)]">
              Conditioning
            </label>
            <Choice
              options={[
                { value: "too_easy", label: "Too easy" },
                { value: "about_right", label: "About right" },
                { value: "too_hard", label: "Too hard" },
              ]}
              value={conditioning}
              onPick={setConditioning}
              clearable
            />
          </div>
        )}

        {/* Pain */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-[var(--color-text)]">
            Did anything hurt?
          </label>
          <Choice
            options={[
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
            ]}
            value={painResponse}
            onPick={(v) => setPainResponse((v as "no" | "yes") ?? "no")}
          />
          {painResponse === "yes" && (
            <input
              type="text"
              placeholder="What and where?"
              value={painNotes}
              onChange={(e) => setPainNotes(e.target.value)}
              className="w-full mt-3 px-3 py-3 font-base text-base rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
              style={{ minHeight: "48px" }}
            />
          )}
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-[var(--color-text)]">
            Note (optional)
          </label>
          <textarea
            placeholder="Any notes?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full px-3 py-3 text-base rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] resize-none"
          />
        </div>

        {/* Bodyweight */}
        <details className="group cursor-pointer">
          <summary className="text-sm font-semibold text-[var(--color-text)] select-none">
            Add bodyweight
          </summary>
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <Stepper
                label="lb"
                value={bodyweightTouched ? bodyweight : null}
                step={0.5}
                unit="lb"
                onStep={handleBodyweightStep}
                wide
              />
              {bodyweightTouched && bodyweight !== null && (
                <button
                  type="button"
                  className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-2"
                  onClick={() => {
                    setBodyweight(null);
                    setBodyweightTouched(false);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            {!bodyweightTouched && props.lastBodyweight && (
              <div className="text-xs text-[var(--color-text-muted)] text-center mt-2">
                tap to set (last: {props.lastBodyweight} lb)
              </div>
            )}
          </div>
        </details>

        {/* Submit */}
        <button
          type="button"
          className={`${btnAccent} w-full`}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {props.busy ? "Saving…" : "Finish workout"}
        </button>
      </div>
    </Sheet>
  );
}
