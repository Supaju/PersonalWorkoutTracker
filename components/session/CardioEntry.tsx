"use client";
import { useState } from "react";
import type { LiveCardio, CardioSettings } from "@/lib/live-session";
import { btn, btnAccent, chipOn, Stepper, Choice } from "./ui";

const machineOptions = [
  { value: "recumbent_bike", label: "Recumbent bike" },
  { value: "treadmill", label: "Treadmill" },
  { value: "elliptical", label: "Elliptical" },
  { value: "rower", label: "Rower" },
  { value: "sled", label: "Sled" },
  { value: "other", label: "Other" },
];

const presetIntervals = [
  { label: "5 × 1 min hard / 1 min easy", value: "5 x 1 min hard / 1 min easy" },
  { label: "6 × 1/1", value: "6 x 1 min hard / 1 min easy" },
  { label: "Steady", value: null as string | null },
];

const effortOptions = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

const talkTestOptions = [
  { value: "full_sentences", label: "Full sentences" },
  { value: "short_phrases", label: "Short phrases" },
  { value: "few_words", label: "Few words" },
];

export default function CardioEntry(props: {
  cardio: LiveCardio;
  onPatch: (p: Partial<LiveCardio>) => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
}) {
  const { cardio, onPatch } = props;
  const [showCustomIntervals, setShowCustomIntervals] = useState(
    cardio.intervals && !presetIntervals.some((p) => p.value === cardio.intervals)
  );

  const machineValue = machineOptions.some((o) => o.value === cardio.machine)
    ? cardio.machine
    : cardio.machine;

  const allMachineOptions = machineOptions.some((o) => o.value === cardio.machine)
    ? machineOptions
    : [
        ...machineOptions,
        { value: cardio.machine, label: cardio.machine },
      ];

  const showSpeed = cardio.machine === "treadmill" || !["recumbent_bike", "elliptical", "rower"].includes(cardio.machine);
  const showIncline = cardio.machine === "treadmill" || !["recumbent_bike", "elliptical", "rower"].includes(cardio.machine);
  const showLevel = ["recumbent_bike", "elliptical", "rower"].includes(cardio.machine) || !["treadmill"].includes(cardio.machine);

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
      {/* Machine select */}
      <div>
        <select
          value={machineValue}
          onChange={(e) => onPatch({ machine: e.target.value })}
          className="w-full min-h-[48px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] font-bold px-3 py-2"
        >
          {allMachineOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {cardio.plan && (
          <div className="text-sm text-[var(--color-text-muted)] mt-2">
            Plan: {cardio.plan.minutes} min {cardio.plan.intervals ?? ""} {cardio.plan.settings ?? ""} — {cardio.plan.targetEffort}
          </div>
        )}
      </div>

      {/* Minutes */}
      <Stepper
        label="min"
        value={cardio.minutes}
        step={1}
        onStep={(d) => onPatch({ minutes: Math.max(1, cardio.minutes + d) })}
      />

      {/* Settings steppers */}
      <div className="space-y-2">
        {showSpeed && (
          <Stepper
            label="speed"
            value={cardio.settings.speed ?? null}
            step={0.1}
            onStep={(d) =>
              onPatch({
                settings: {
                  ...cardio.settings,
                  speed: Math.max(0, +(((cardio.settings.speed ?? 0) + d).toFixed(1))),
                },
              })
            }
          />
        )}
        {showIncline && (
          <Stepper
            label="incline"
            value={cardio.settings.incline ?? null}
            step={0.5}
            onStep={(d) =>
              onPatch({
                settings: {
                  ...cardio.settings,
                  incline: Math.max(0, +(((cardio.settings.incline ?? 0) + d).toFixed(1))),
                },
              })
            }
          />
        )}
        {showLevel && (
          <Stepper
            label="level"
            value={cardio.settings.level ?? null}
            step={1}
            onStep={(d) =>
              onPatch({
                settings: {
                  ...cardio.settings,
                  level: Math.max(0, +(((cardio.settings.level ?? 0) + d).toFixed(1))),
                },
              })
            }
          />
        )}
      </div>

      {/* Intervals */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {presetIntervals.map((preset) => (
            <button
              key={preset.value ?? "steady"}
              type="button"
              className={`${btn} flex-1 px-3 text-sm ${
                cardio.intervals === preset.value ? chipOn : ""
              }`}
              onClick={() => {
                onPatch({ intervals: preset.value });
                setShowCustomIntervals(false);
              }}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className={`${btn} flex-1 px-3 text-sm ${showCustomIntervals ? chipOn : ""}`}
            onClick={() => setShowCustomIntervals(!showCustomIntervals)}
          >
            Custom
          </button>
        </div>
        {showCustomIntervals && (
          <input
            type="text"
            value={cardio.intervals ?? ""}
            onChange={(e) => onPatch({ intervals: e.target.value || null })}
            placeholder="e.g., 10 × 30 sec sprint"
            className="w-full min-h-[48px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2 text-[16px]"
          />
        )}
      </div>

      {/* Perceived effort */}
      <div className="space-y-2">
        <div className="text-sm text-[var(--color-text-muted)]">How hard? (1 easy – 10 max)</div>
        <div className="grid grid-cols-5 gap-2">
          {effortOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`${btn} text-sm ${cardio.perceivedEffort === o.value ? chipOn : ""}`}
              onClick={() =>
                onPatch({
                  perceivedEffort: cardio.perceivedEffort === o.value ? null : o.value,
                })
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Talk test */}
      <div className="space-y-2">
        <div className="text-sm text-[var(--color-text-muted)]">Talk test</div>
        <Choice
          options={talkTestOptions}
          value={cardio.talkTest}
          onPick={(v) => onPatch({ talkTest: v as LiveCardio["talkTest"] })}
          clearable
        />
      </div>

      {/* More (HR, distance, calories) */}
      <details className="space-y-2">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          More (HR, distance, calories)
        </summary>
        <div className="space-y-2 pt-2">
          <Stepper
            label="HR"
            value={cardio.heartRate}
            step={5}
            onStep={(d) =>
              onPatch({
                heartRate: Math.max(0, (cardio.heartRate ?? 120) + d),
              })
            }
          />
          <Stepper
            label="mi"
            value={cardio.distanceMi}
            step={0.1}
            onStep={(d) =>
              onPatch({
                distanceMi: Math.max(0, +(((cardio.distanceMi ?? 0) + d).toFixed(1))),
              })
            }
          />
          <Stepper
            label="kcal"
            value={cardio.calories}
            step={10}
            onStep={(d) =>
              onPatch({
                calories: Math.max(0, (cardio.calories ?? 0) + d),
              })
            }
          />
        </div>
      </details>

      {/* Footer */}
      {!cardio.done ? (
        <button
          type="button"
          className={`${btnAccent} w-full`}
          onClick={props.onConfirm}
        >
          Log cardio ✓
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
            Logged ✓
          </div>
          <button
            type="button"
            className={btn}
            onClick={props.onUnconfirm}
          >
            Edit
          </button>
        </div>
      )}
    </section>
  );
}
