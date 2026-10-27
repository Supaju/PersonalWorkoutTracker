"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type ExerciseSeries = {
  date: string;
  topWeight: number;
  e1rm: number;
};

type Exercise = {
  name: string;
  unit: string;
  series: ExerciseSeries[];
};

type BodyweightPoint = {
  date: string;
  lbs: number;
};

type AdherencePoint = {
  weekStart: string;
  planned: number;
  completed: number;
};

type CardioPoint = {
  weekStart: string;
  minutes: number;
};

type VersionMarker = {
  version: number;
  phase: string;
  startDate: string;
};

type ProgressData = {
  exercises: Exercise[];
  bodyweight: BodyweightPoint[];
  adherence: AdherencePoint[];
  cardioMinutesByWeek: CardioPoint[];
  versionMarkers: VersionMarker[];
};

function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  return `${m}/${d}`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text)",
      }}
      className="px-3 py-2 text-xs"
    >
      <p className="text-[var(--color-text-muted)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

function ExerciseSection({
  exercises,
  versionMarkers,
}: {
  exercises: Exercise[];
  versionMarkers: VersionMarker[];
}) {
  if (exercises.length === 0) {
    return null;
  }

  // Sort by most recent series date, then by name
  const sorted = [...exercises].sort((a, b) => {
    const aDate = a.series.length > 0 ? a.series[a.series.length - 1].date : "";
    const bDate = b.series.length > 0 ? b.series[b.series.length - 1].date : "";
    if (bDate !== aDate) return bDate.localeCompare(aDate);
    return a.name.localeCompare(b.name);
  });

  // Default to exercise with most data points
  const [selected, setSelected] = useState(
    sorted.reduce((max, ex) =>
      ex.series.length > max.series.length ? ex : max
    )
  );

  const seriesData = selected.series.map((s) => ({
    date: s.date,
    "Working weight": s.topWeight,
    "Est. strength": s.e1rm,
  }));

  // Filter version markers within date range
  const dateRange =
    seriesData.length > 0
      ? {
          min: seriesData[0].date,
          max: seriesData[seriesData.length - 1].date,
        }
      : null;

  const relevantMarkers = dateRange
    ? versionMarkers.filter((v) => v.startDate >= dateRange.min && v.startDate <= dateRange.max)
    : [];

  // Map marker dates to nearest category at or after
  const markerLines = relevantMarkers
    .map((m) => {
      const exact = seriesData.find((d) => d.date === m.startDate);
      if (exact) return { ...m, displayDate: m.startDate };

      const next = seriesData.find((d) => d.date >= m.startDate);
      if (next) return { ...m, displayDate: next.date };

      return null;
    })
    .filter((m): m is (typeof relevantMarkers[0] & { displayDate: string }) => m !== null);

  const hasVersionInfo = markerLines.length > 0;

  const unitLabel =
    selected.unit === "per_hand" ? `lb (per hand)` : "lb";

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-4">
        <label htmlFor="exercise-select" className="block text-xs text-[var(--color-text-muted)] mb-2">
          Exercise
        </label>
        <select
          id="exercise-select"
          value={selected.name}
          onChange={(e) => {
            const ex = sorted.find((x) => x.name === e.target.value);
            if (ex) setSelected(ex);
          }}
          className="w-full min-h-[48px] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] px-3 py-2 rounded text-sm"
        >
          {sorted.map((ex) => (
            <option key={ex.name} value={ex.name}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      {seriesData.length < 2 ? (
        <div className="text-xs text-[var(--color-text-muted)] p-4">
          <p className="mb-2">Data points:</p>
          <ul>
            {seriesData.map((d) => (
              <li key={d.date}>{formatDateShort(d.date)}: {d["Working weight"]}lb</li>
            ))}
          </ul>
          <p className="mt-2">Need more sessions for a trend</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={seriesData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
              />
              <YAxis
                label={{
                  value: unitLabel,
                  angle: -90,
                  position: "insideLeft",
                  fill: "var(--color-text-muted)",
                  fontSize: 12,
                }}
                tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              {markerLines.map((m) => (
                <ReferenceLine
                  key={m.version}
                  x={m.displayDate}
                  stroke="var(--color-text-faint)"
                  label={{
                    value: `v${m.version}`,
                    position: "top",
                    fill: "var(--color-text-muted)",
                    fontSize: 10,
                  }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="Working weight"
                stroke="var(--color-accent)"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Est. strength"
                stroke="#3b82f6"
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          {hasVersionInfo && (
            <div className="mt-2 text-xs text-[var(--color-text-faint)]">
              {markerLines.map((m) => (
                <div key={m.version}>
                  v{m.version} = {m.phase}, from {m.startDate}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BodyweightSection({
  bodyweight,
  versionMarkers,
}: {
  bodyweight: BodyweightPoint[];
  versionMarkers: VersionMarker[];
}) {
  if (bodyweight.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">
          Bodyweight (lb)
        </h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          No bodyweight logged yet.
        </p>
      </div>
    );
  }

  const data = bodyweight.map((b) => ({
    date: b.date,
    lbs: b.lbs,
  }));

  const dateRange = {
    min: data[0].date,
    max: data[data.length - 1].date,
  };

  const relevantMarkers = versionMarkers.filter(
    (v) => v.startDate >= dateRange.min && v.startDate <= dateRange.max
  );

  const markerLines = relevantMarkers
    .map((m) => {
      const exact = data.find((d) => d.date === m.startDate);
      if (exact) return { ...m, displayDate: m.startDate };

      const next = data.find((d) => d.date >= m.startDate);
      if (next) return { ...m, displayDate: next.date };

      return null;
    })
    .filter((m): m is (typeof relevantMarkers[0] & { displayDate: string }) => m !== null);

  const minLbs = Math.min(...data.map((d) => d.lbs));
  const maxLbs = Math.max(...data.map((d) => d.lbs));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">
        Bodyweight (lb)
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
          />
          <YAxis
            domain={[minLbs - 3, maxLbs + 3]}
            tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
          />
          <Tooltip content={<ChartTooltip />} />
          {markerLines.map((m) => (
            <ReferenceLine
              key={m.version}
              x={m.displayDate}
              stroke="var(--color-text-faint)"
              label={{
                value: `v${m.version}`,
                position: "top",
                fill: "var(--color-text-muted)",
                fontSize: 10,
              }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="lbs"
            stroke="var(--color-accent)"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AdherenceSection({ adherence }: { adherence: AdherencePoint[] }) {
  const last12 = adherence.slice(-12);
  if (last12.length === 0) {
    return null;
  }

  const data = last12.map((a) => ({
    weekStart: a.weekStart,
    "M/D": formatDateShort(a.weekStart),
    Planned: a.planned,
    Completed: a.completed,
  }));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">
        Sessions per week (planned vs done)
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
          />
          <XAxis
            dataKey="M/D"
            tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
          />
          <YAxis
            tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          <Bar dataKey="Planned" fill="var(--color-text-faint)" />
          <Bar dataKey="Completed" fill="var(--color-accent)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardioSection({ cardioMinutesByWeek }: { cardioMinutesByWeek: CardioPoint[] }) {
  const last12 = cardioMinutesByWeek.slice(-12);
  if (last12.length === 0) {
    return null;
  }

  const data = last12.map((c) => ({
    weekStart: c.weekStart,
    "M/D": formatDateShort(c.weekStart),
    minutes: c.minutes,
  }));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">
        Cardio minutes per week
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
          />
          <XAxis
            dataKey="M/D"
            tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
          />
          <YAxis
            tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="minutes" fill="var(--color-accent)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/progress", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError("Couldn't load progress");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <main className="p-4 max-w-[390px] mx-auto space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 h-32 animate-pulse" />
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 h-32 animate-pulse" />
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 h-32 animate-pulse" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-4 max-w-[390px] mx-auto">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <main className="p-4 max-w-[390px] mx-auto space-y-4 pb-8">
      <h1 className="text-lg font-semibold text-[var(--color-text)] mb-4">
        Progress
      </h1>

      <ExerciseSection
        exercises={data.exercises}
        versionMarkers={data.versionMarkers}
      />
      <BodyweightSection
        bodyweight={data.bodyweight}
        versionMarkers={data.versionMarkers}
      />
      <AdherenceSection adherence={data.adherence} />
      <CardioSection cardioMinutesByWeek={data.cardioMinutesByWeek} />
    </main>
  );
}
