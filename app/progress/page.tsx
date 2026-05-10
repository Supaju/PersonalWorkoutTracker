"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type DataPoint = {
  date: string;
  maxWeight: number;
  volume: number;
  sets: number;
  reps: number;
};

type ExerciseProgress = {
  name: string;
  muscleGroup: string;
  data: DataPoint[];
};

type RecentPR = {
  name: string;
  weight: number;
  delta: number;
};

type ProgressData = {
  exercises: ExerciseProgress[];
  recentPRs: RecentPR[];
};

const TAB_ORDER = ["legs", "chest", "back", "shoulders", "arms", "other"];
const TAB_LABELS: Record<string, string> = {
  legs: "Legs",
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  other: "Other",
};

function Sparkline({ data }: { data: DataPoint[] }) {
  if (data.length === 0) return null;
  const W = 200;
  const H = 40;
  const weights = data.map((d) => d.maxWeight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const pts = weights.map((w, i) => ({
    x: weights.length === 1 ? W / 2 : (i / (weights.length - 1)) * W,
    y: H - ((w - min) / range) * (H - 6) - 3,
  }));

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8" preserveAspectRatio="none">
      {data.length > 1 && (
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
        />
      )}
      <circle cx={last.x} cy={last.y} r="3" fill="var(--color-accent)" />
    </svg>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DataPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-xs">
      <p className="text-[var(--color-text-faint)] mb-1">{d.date}</p>
      <p className="text-[var(--color-text)] font-bold">{d.maxWeight} lbs</p>
      <p className="text-[var(--color-text-faint)]">
        Vol: {Math.round(d.volume).toLocaleString()} lbs
      </p>
      <p className="text-[var(--color-text-faint)]">
        {d.reps} reps × {d.sets} sets
      </p>
    </div>
  );
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("legs");
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => r.json())
      .then((d: ProgressData) => {
        setData(d);
        const firstTab = TAB_ORDER.find((t) =>
          d.exercises.some((e) => e.muscleGroup === t)
        );
        if (firstTab) setActiveTab(firstTab);
      });
  }, []);

  if (!data) {
    return (
      <div className="text-[var(--color-text-faint)] text-sm">Loading...</div>
    );
  }

  if (data.exercises.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">
          Strength Progress
        </h2>
        <p className="text-[var(--color-text-faint)] text-sm mb-8">
          Max weight lifted per exercise over time.
        </p>
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-faint)]">
          <p className="text-sm">
            Record some sessions to see your strength progress.
          </p>
          <p className="text-xs mt-1 opacity-70">
            Only recorded sessions count — planned sessions are excluded.
          </p>
        </div>
      </div>
    );
  }

  const availableTabs = TAB_ORDER.filter((t) =>
    data.exercises.some((e) => e.muscleGroup === t)
  );
  const tabExercises = data.exercises.filter((e) => e.muscleGroup === activeTab);
  const exerciseDetail = selectedExercise
    ? data.exercises.find((e) => e.name === selectedExercise) ?? null
    : null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1 uppercase tracking-wide">
        Strength Progress
      </h2>
      <p className="text-[var(--color-text-faint)] text-sm mb-8">
        Max weight lifted per exercise over time.
      </p>

      {/* Recent PRs strip */}
      {data.recentPRs.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-3">
            Recent PRs
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.recentPRs.map((pr) => (
              <button
                key={pr.name}
                onClick={() => {
                  const tab =
                    data.exercises.find((e) => e.name === pr.name)
                      ?.muscleGroup ?? activeTab;
                  setActiveTab(tab);
                  setSelectedExercise(pr.name);
                }}
                className="bg-[#0a1a0a] border border-[#1a3a1a] p-4 text-left hover:border-[#86efac] transition-colors"
              >
                <p className="text-xs text-[#86efac] uppercase tracking-wider truncate">
                  {pr.name}
                </p>
                <p className="text-xl font-bold text-[var(--color-text)] mt-1">
                  {pr.weight}
                  <span className="text-xs font-normal text-[var(--color-text-faint)]">
                    {" "}
                    lbs
                  </span>
                </p>
                <p className="text-xs mt-1">
                  {pr.delta > 0 ? (
                    <span className="text-[#86efac]">↑ +{pr.delta} lbs</span>
                  ) : (
                    <span className="text-[var(--color-text-faint)]">
                      → first entry
                    </span>
                  )}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drill-down view */}
      {exerciseDetail ? (
        <div>
          <button
            onClick={() => setSelectedExercise(null)}
            className="text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)] mb-6"
          >
            ← Back to {TAB_LABELS[activeTab] ?? activeTab}
          </button>

          <div className="mb-6">
            <h3 className="text-xl font-bold text-[var(--color-text)] uppercase tracking-wide">
              {exerciseDetail.name}
            </h3>
            <div className="flex flex-wrap gap-6 mt-2 text-sm">
              <span className="text-[#86efac]">
                PR:{" "}
                {Math.max(...exerciseDetail.data.map((d) => d.maxWeight))} lbs
              </span>
              <span className="text-[var(--color-text-faint)]">
                Started: {exerciseDetail.data[0].maxWeight} lbs
              </span>
              {exerciseDetail.data.length > 1 && (
                <span className="text-[var(--color-accent)]">
                  {(
                    ((exerciseDetail.data[exerciseDetail.data.length - 1]
                      .maxWeight -
                      exerciseDetail.data[0].maxWeight) /
                      exerciseDetail.data[0].maxWeight) *
                    100
                  ).toFixed(0)}
                  % over {exerciseDetail.data.length} sessions
                </span>
              )}
            </div>
          </div>

          {exerciseDetail.data.length === 1 ? (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center text-[var(--color-text-faint)] text-sm mb-6">
              Only one session recorded — come back after your next workout.
            </div>
          ) : (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 mb-6">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={exerciseDetail.data}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="weightGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#dc2626"
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor="#dc2626"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#555", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#555", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="maxWeight"
                    stroke="#dc2626"
                    strokeWidth={2}
                    fill="url(#weightGrad)"
                    dot={{ fill: "#dc2626", r: 3 }}
                    activeDot={{ r: 5, fill: "#dc2626" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <h3 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-3">
            Session History
          </h3>
          <div className="space-y-1">
            {[...exerciseDetail.data].reverse().map((d, i, arr) => {
              const prev = arr[i + 1];
              const delta = prev ? d.maxWeight - prev.maxWeight : null;
              return (
                <div
                  key={d.date}
                  className="flex items-center gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3 text-sm"
                >
                  <span className="text-[var(--color-text-faint)] w-24 shrink-0">
                    {d.date}
                  </span>
                  <span className="font-bold text-[var(--color-text)] w-20">
                    {d.maxWeight} lbs
                  </span>
                  <span className="text-xs w-24">
                    {delta === null ? (
                      <span className="text-[var(--color-text-faint)]">—</span>
                    ) : delta > 0 ? (
                      <span className="text-[#86efac]">+{delta} lbs</span>
                    ) : delta < 0 ? (
                      <span className="text-[#f87171]">{delta} lbs</span>
                    ) : (
                      <span className="text-[var(--color-text-faint)]">
                        no change
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-[var(--color-text-faint)]">
                    {d.reps} reps × {d.sets} sets
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Grid view */
        <div>
          {/* Tab bar */}
          <div className="flex border-b border-[var(--color-border)] mb-6">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
                }`}
              >
                {TAB_LABELS[tab] ?? tab}
              </button>
            ))}
          </div>

          {/* Sparkline grid */}
          <div className="grid grid-cols-2 gap-4">
            {tabExercises.map((ex) => {
              const latest = ex.data[ex.data.length - 1];
              const pct =
                ex.data.length > 1
                  ? ((latest.maxWeight - ex.data[0].maxWeight) /
                      ex.data[0].maxWeight) *
                    100
                  : null;
              return (
                <button
                  key={ex.name}
                  onClick={() => setSelectedExercise(ex.name)}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 text-left hover:border-[var(--color-text-faint)] transition-colors"
                >
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-bold text-[var(--color-text)] truncate mr-2">
                      {ex.name}
                    </span>
                    <span className="text-sm text-[var(--color-accent)] shrink-0">
                      {latest.maxWeight} lbs
                    </span>
                  </div>
                  <Sparkline data={ex.data} />
                  <div className="mt-2 text-xs">
                    {pct === null ? (
                      <span className="text-[var(--color-text-faint)]">
                        1 session
                      </span>
                    ) : pct > 0 ? (
                      <span className="text-[#86efac]">
                        ↑ +{pct.toFixed(0)}% over {ex.data.length} sessions
                      </span>
                    ) : pct < 0 ? (
                      <span className="text-[#f87171]">
                        ↓ {pct.toFixed(0)}% over {ex.data.length} sessions
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-faint)]">
                        → no change over {ex.data.length} sessions
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
