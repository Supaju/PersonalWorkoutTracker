"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import {
  ApiSession,
  parsePlan,
  parsePrescription,
  pairLabels,
  plannedCardioFor,
  loadText,
  BLOCK_LABEL,
  BLOCK_ORDER,
  sessionLabel,
} from "@/components/session/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(dateStr: string): { long: string; weekday: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const long = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  const weekday = weekdays[d.getUTCDay()];
  return { long, weekday };
}

function WeekdayBoxes({ sessionDate }: { sessionDate: string }) {
  const today = new Date(sessionDate + "T00:00:00Z");
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() - today.getUTCDay());
  const weekdays = ["M", "T", "W", "T", "F", "S", "S"];
  const boxes = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const isSession = dateStr === sessionDate;
    boxes.push(
      <div
        key={i}
        className={`w-7 h-7 flex items-center justify-center border border-black text-xs font-bold ${
          isSession ? "bg-black text-white" : ""
        }`}
      >
        {weekdays[i]}
      </div>
    );
  }
  return <div className="flex gap-1">{boxes}</div>;
}

function SetGrid({
  session,
  exerciseIndex,
  maxSets,
}: {
  session: ApiSession;
  exerciseIndex: number;
  maxSets: number;
}) {
  const ex = session.exercises[exerciseIndex];
  const prescription = parsePrescription(ex);

  const cells = [];
  for (let setNum = 0; setNum < maxSets; setNum++) {
    const pres = prescription[setNum];
    let targetText = "";

    if (pres) {
      const lines = [];
      if (pres.weight !== null) {
        lines.push(loadText(ex.unit, pres.weight));
      } else if (ex.unit === "bodyweight") {
        lines.push("BW");
      }

      if (pres.reps !== null) {
        lines.push(`x ${pres.reps}`);
      } else if (pres.durationSec !== null) {
        lines.push(`${pres.durationSec}s`);
      } else if (pres.distanceYd !== null) {
        lines.push(`${pres.distanceYd} yd`);
      }

      if (pres.setType === "ramp") {
        lines.push("R");
      }

      targetText = lines.join(" ");
    }

    cells.push(
      <div key={setNum} className="border border-black min-h-[44px] p-1 text-center text-xs">
        <div className="font-bold">{targetText}</div>
        <div className="mt-2 h-6" />
      </div>
    );
  }

  return (
    <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${maxSets}, 1fr)` }}>
      {cells}
    </div>
  );
}

function BlockTable({
  session,
  blockName,
  pairLabelsMap,
}: {
  session: ApiSession;
  blockName: string;
  pairLabelsMap: (string | null)[];
}) {
  const blockExercises = session.exercises.filter((ex) => ex.block === blockName);
  if (blockExercises.length === 0) return null;

  const maxSets = Math.max(
    ...blockExercises.map((ex) => {
      const pres = parsePrescription(ex);
      return pres.length || (ex.unit === "cardio" || plannedCardioFor(session, ex) ? 0 : 6);
    }),
    6
  );

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold mb-2 border-b border-black pb-1">{BLOCK_LABEL[blockName]}</h2>
      <table className="w-full border-collapse border border-black">
        <thead>
          <tr>
            <td className="border border-black p-2 font-bold text-sm w-1/3">Exercise</td>
            {Array.from({ length: maxSets }).map((_, i) => (
              <td key={i} className="border border-black p-1 text-center font-bold text-xs">
                Set {i + 1}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {blockExercises.map((ex, idx) => {
            const exIndex = session.exercises.indexOf(ex);
            const pairLabel = pairLabelsMap[exIndex];
            const isCardio = ex.unit === "cardio" || plannedCardioFor(session, ex);

            if (isCardio) {
              return null;
            }

            const pres = parsePrescription(ex);

            return (
              <tr key={ex.id}>
                <td className="border border-black p-2 align-top">
                  <div className="font-bold text-sm">
                    {pairLabel && <span className="mr-1">{pairLabel}</span>}
                    {ex.name}
                    {ex.unit === "per_hand" && <span className="text-xs text-gray-600"> (each hand)</span>}
                  </div>
                  {ex.cue && <div className="text-xs italic text-gray-600 mt-1">{ex.cue}</div>}
                </td>
                {Array.from({ length: maxSets }).map((_, setIdx) => {
                  const pres_set = pres[setIdx];
                  let target = "";

                  if (pres_set) {
                    const lines = [];
                    if (pres_set.weight !== null) {
                      lines.push(loadText(ex.unit, pres_set.weight));
                    } else if (ex.unit === "bodyweight") {
                      lines.push("BW");
                    }

                    if (pres_set.reps !== null) {
                      lines.push(`x ${pres_set.reps}`);
                    } else if (pres_set.durationSec !== null) {
                      lines.push(`${pres_set.durationSec}s`);
                    } else if (pres_set.distanceYd !== null) {
                      lines.push(`${pres_set.distanceYd} yd`);
                    }

                    if (pres_set.setType === "ramp") {
                      target = (target ? target + " " : "") + "R";
                    }

                    target = lines.join(" ") + (target ? " " + target : "");
                  }

                  return (
                    <td key={setIdx} className="border border-black p-1 min-h-[44px] align-top">
                      <div className="text-center text-xs font-bold h-6">{target}</div>
                      <div className="h-6" />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CardioTable({ session, pairLabelsMap }: { session: ApiSession; pairLabelsMap: (string | null)[] }) {
  const cardioExercises = session.exercises.filter((ex) => {
    const hasPlannedCardio = plannedCardioFor(session, ex);
    return ex.unit === "cardio" || hasPlannedCardio;
  });

  if (cardioExercises.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold mb-2 border-b border-black pb-1">Cardio</h2>
      <table className="w-full border-collapse border border-black text-sm">
        <thead>
          <tr>
            <td className="border border-black p-2 font-bold">Machine</td>
            <td className="border border-black p-2 font-bold">Planned</td>
            <td className="border border-black p-2 font-bold">Time</td>
            <td className="border border-black p-2 font-bold">Distance</td>
            <td className="border border-black p-2 font-bold">HR</td>
            <td className="border border-black p-2 font-bold">Calories</td>
          </tr>
        </thead>
        <tbody>
          {cardioExercises.map((ex) => {
            const plannedCardio = plannedCardioFor(session, ex);
            const cardioLog = ex.cardio && ex.cardio.length > 0 ? ex.cardio[0] : null;

            return (
              <tr key={ex.id}>
                <td className="border border-black p-2 min-h-[44px]">
                  <div className="font-semibold">{ex.name}</div>
                  {cardioLog?.machine && <div className="text-xs text-gray-600">{cardioLog.machine}</div>}
                </td>
                <td className="border border-black p-2 min-h-[44px] text-xs">
                  {plannedCardio ? (
                    <div>
                      <div>{plannedCardio.minutes} min</div>
                      {plannedCardio.intervals && <div>{plannedCardio.intervals}</div>}
                      {plannedCardio.settings && <div>{plannedCardio.settings}</div>}
                      <div className="text-xs">{plannedCardio.targetEffort}</div>
                    </div>
                  ) : null}
                </td>
                <td className="border border-black p-2 min-h-[44px]" />
                <td className="border border-black p-2 min-h-[44px]" />
                <td className="border border-black p-2 min-h-[44px]" />
                <td className="border border-black p-2 min-h-[44px]" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SessionPrintPage({ params }: PageProps) {
  const { id } = use(params);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Session not found");
        return res.json();
      })
      .then(setSession)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-4">
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="p-4">
        <p className="text-red-600">Error: {error || "Session not found"}</p>
        <Link href={`/sessions/${id}`} className="text-blue-600 underline">
          Back to session
        </Link>
      </div>
    );
  }

  const { long: longDate, weekday } = formatDate(session.date);
  const pairLabelsMap = pairLabels(session.exercises);

  return (
    <div className="bg-white text-black fixed inset-0 overflow-auto z-50 no-print:overflow-visible no-print:fixed-none">
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          nav, header, aside, [data-app-nav] {
            display: none !important;
          }
          body {
            background: white !important;
            margin: 0;
            padding: 0;
          }
          @page {
            margin: 12mm;
          }
          table {
            page-break-inside: avoid;
          }
        }
        body {
          background: white;
        }
      `}</style>

      <div className="no-print p-4 flex gap-2 border-b border-black">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-black text-white font-bold hover:bg-gray-800"
        >
          Print
        </button>
        <Link
          href={`/sessions/${id}`}
          className="px-4 py-2 border border-black font-bold hover:bg-gray-100"
        >
          Back
        </Link>
      </div>

      <div className="p-12 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Workout log</h1>
          <div className="flex gap-4 mb-4">
            <div>
              <div className="text-sm font-bold">{sessionLabel(session.sessionType)}</div>
              <div className="text-sm">{longDate}</div>
            </div>
            <div>
              <WeekdayBoxes sessionDate={session.date} />
            </div>
          </div>

          <div className="mb-4 space-y-2 text-sm">
            <div className="flex gap-8">
              <div>
                Start <span className="inline-block w-24 border-b border-black" />
              </div>
              <div>
                End <span className="inline-block w-24 border-b border-black" />
              </div>
              <div>
                Bodyweight <span className="inline-block w-24 border-b border-black" />
              </div>
            </div>
          </div>

          {session.coachNotes && (
            <div className="text-sm mb-4">
              <span className="font-bold">Coach: </span>
              {session.coachNotes}
            </div>
          )}
        </div>

        {/* Exercise blocks */}
        {BLOCK_ORDER.map((blockName) => {
          const hasExercises = session.exercises.some((ex) => ex.block === blockName);
          const hasCardioOnly = session.exercises
            .filter((ex) => ex.block === blockName)
            .every((ex) => ex.unit === "cardio" || plannedCardioFor(session, ex));

          if (!hasExercises || hasCardioOnly) return null;

          return (
            <BlockTable
              key={blockName}
              session={session}
              blockName={blockName}
              pairLabelsMap={pairLabelsMap}
            />
          );
        })}

        {/* Cardio table */}
        <CardioTable session={session} pairLabelsMap={pairLabelsMap} />
      </div>
    </div>
  );
}
