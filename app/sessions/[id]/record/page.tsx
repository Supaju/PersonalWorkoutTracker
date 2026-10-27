"use client";
// Live record mode: one exercise in focus, everything saved through the offline queue as you go.
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createQueue, loadSnapshot, pendingCount, saveSnapshot, type OfflineQueue } from "@/lib/offline-queue";
import { diffMutations, fromSession, liveReducer, type LiveAction, type LiveExercise, type LiveState } from "@/lib/live-session";
import { pairLabels, parseReview, todayStr, type ApiQuestion, type ApiSession, type Preference, type SessionReview } from "@/components/session/types";
import ExerciseCard from "@/components/session/ExerciseCard";
import FeedbackSheet from "@/components/session/FeedbackSheet";
import CheckOutSheet, { type CheckOutData } from "@/components/session/CheckOutSheet";
import ReviewPanel from "@/components/session/ReviewPanel";
import { AddExerciseSheet, SkipSheet, SwapSheet } from "@/components/session/ActionSheets";
import { btn, btnAccent } from "@/components/session/ui";

interface Meta { name: string | null; date: string; phase: string; startedAt: string | null; reviewed: boolean; hasConditioning: boolean; lastBw: number | null }
type Open = { kind: "skip" | "swap" | "tag"; ex: string } | { kind: "add" } | null;

const mmss = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, sec) % 60).padStart(2, "0")}`;

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.15;
    o.start(); o.stop(ctx.currentTime + 0.35);
  } catch { /* no audio */ }
}

export default function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [live, setLive] = useState<LiveState | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sync, setSync] = useState({ pending: 0, offline: false });
  const [open, setOpen] = useState<Open>(null);
  const [now, setNow] = useState(() => Date.now());
  const [stage, setStage] = useState<"live" | "checkout" | "finishing" | "review">("live");
  const [review, setReview] = useState<{ review: SessionReview; questions: ApiQuestion[] } | null>(null);
  const [updating, setUpdating] = useState(false);
  const liveRef = useRef<LiveState | null>(null);
  const queue = useRef<OfflineQueue | null>(null);
  const reviewed = useRef(false);
  const reReview = useRef<() => void>(() => {});
  const beeped = useRef(0);

  const runReview = useCallback(async () => {
    setUpdating(true);
    try {
      const r = await fetch(`/api/sessions/${id}/review`, { method: "POST" });
      if (!r.ok) throw new Error(String(r.status));
      const rev = (await r.json()) as SessionReview;
      const s = (await (await fetch(`/api/sessions/${id}`, { cache: "no-store" })).json()) as ApiSession;
      reviewed.current = true;
      setReview({ review: rev, questions: s.questions ?? [] });
      setErr(null);
    } catch { setErr("Couldn't get the coach review yet. Your workout is saved; try again."); }
    finally { setUpdating(false); }
  }, [id]);
  reReview.current = () => { if (reviewed.current) void runReview(); };

  // Load: server state, unless unsent local edits exist (then the local snapshot is the truth).
  useEffect(() => {
    const q = createQueue(id, {
      onChange: (s) => setSync({ pending: s.pending, offline: s.offline }),
      onReReview: () => reReview.current(),
      onDrop: (_m, status) => setErr(`One change was rejected by the server (${status}).`),
    });
    queue.current = q;
    let alive = true;
    (async () => {
      let session: ApiSession | null = null;
      try {
        const r = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
        if (r.status === 404) { setErr("Session not found."); return; }
        if (r.ok) session = (await r.json()) as ApiSession;
      } catch { /* offline: fall back to the snapshot */ }
      fetch("/api/preferences").then((r) => r.json()).then((p) => alive && setPrefs(p)).catch(() => {});
      const snap = pendingCount(id) > 0 ? loadSnapshot<{ state: LiveState; meta: Meta }>(id) : null;
      if (snap) { liveRef.current = snap.state; setLive(snap.state); setMeta(snap.meta); return; }
      if (!session) { setErr("Can't load this session. Check your connection."); return; }
      const state = fromSession(session);
      const rev = parseReview(session);
      reviewed.current = !!session.reviewedAt;
      const lastBw = null;
      setMeta({
        name: session.name, date: session.date, phase: session.phase, reviewed: !!session.reviewedAt, lastBw,
        startedAt: session.startedAt ?? (session.phase === "planned" ? new Date().toISOString() : null),
        hasConditioning: session.exercises.some((e) => e.block === "conditioning" || e.unit === "cardio"),
      });
      liveRef.current = state; setLive(state);
      if (session.phase === "planned") q.enqueue({ id: crypto.randomUUID(), key: "phase", method: "PATCH", url: `/api/sessions/${id}`, body: { phase: "active" } });
      if (session.phase === "recorded" && rev) setReview({ review: rev, questions: session.questions ?? [] });
    })();
    const stop = q.start();
    return () => { alive = false; stop(); };
  }, [id]);

  useEffect(() => { if (live && meta) saveSnapshot(id, { state: live, meta }); }, [id, live, meta]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { // keep the screen awake between sets
    let lock: { release: () => Promise<void> } | null = null;
    const get = async () => { try { lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* unsupported */ } };
    void get();
    const vis = () => { if (document.visibilityState === "visible") void get(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); void lock?.release().catch(() => {}); };
  }, []);

  const act = useCallback((a: LiveAction) => {
    const prev = liveRef.current;
    if (!prev) return;
    const next = liveReducer(prev, a);
    if (next === prev) return;
    liveRef.current = next; setLive(next);
    for (const m of diffMutations(prev, next)) queue.current?.enqueue(m);
  }, []);

  // Rest timer end: buzz, beep, clear.
  const restEnd = live?.rest?.endsAt ?? 0;
  useEffect(() => {
    if (restEnd && now >= restEnd && beeped.current !== restEnd) {
      beeped.current = restEnd;
      try { navigator.vibrate?.([250, 120, 250]); } catch { /* unsupported */ }
      beep();
      act({ t: "clearRest" });
    }
  }, [now, restEnd, act]);

  const finish = async (d: CheckOutData) => {
    const q = queue.current; if (!q || !meta) return;
    setStage("finishing");
    q.enqueue({ id: crypto.randomUUID(), method: "POST", url: "/api/checkins", body: { kind: "check_out", date: meta.date || todayStr(), sessionId: id, ...d } });
    q.enqueue({ id: crypto.randomUUID(), key: "phase", method: "PATCH", url: `/api/sessions/${id}`, body: { phase: "recorded", finishedAt: new Date().toISOString() } });
    reviewed.current = false;
    await q.flush();
    while (q.pending() > 0) await new Promise((r) => setTimeout(r, 1500)); // offline: stays saved on this phone and finishes on reconnect
    await runReview();
    setStage("review");
  };

  if (err && !live) return <main className="mx-auto max-w-xl p-4"><p role="alert">{err}</p><Link className="underline" href="/sessions">Back to sessions</Link></main>;
  if (!live || !meta) return <main className="mx-auto max-w-xl p-4 text-[var(--color-text-muted)]">Loading…</main>;

  if (stage === "finishing" || stage === "review") {
    return (
      <main className="mx-auto max-w-xl space-y-4 p-4 pb-12 text-[var(--color-text)]">
        <h1 className="text-2xl font-bold">{stage === "review" && review ? "Nice work" : "Wrapping up…"}</h1>
        {sync.pending > 0 && <p className="rounded-xl border border-[var(--color-border)] p-3 text-sm">Saved on this phone. {sync.offline ? "Waiting for a connection" : "Sending"} ({sync.pending} left).</p>}
        {stage === "finishing" && !review && <p className="text-[var(--color-text-muted)]">{updating ? "Your coach is reviewing the session…" : "Saving your workout…"}</p>}
        {err && <p role="alert" className="text-sm">{err} <button className="underline" onClick={() => void runReview()}>Retry</button></p>}
        {review && <ReviewPanel review={review.review} questions={review.questions} updating={updating} />}
        {stage === "review" && <Link href={`/sessions/${id}`} className={`${btnAccent} flex w-full items-center justify-center`}>Done</Link>}
      </main>
    );
  }

  const exs = live.exercises;
  const labels = pairLabels(exs);
  const cur = exs[live.current];
  const next = exs.slice(live.current + 1).find((e) => !e.skipped);
  const elapsed = meta.startedAt ? Math.floor((now - +new Date(meta.startedAt)) / 1000) : 0;
  const restLeft = live.rest ? Math.max(0, Math.ceil((live.rest.endsAt - now) / 1000)) : 0;
  const unlogged = exs.filter((e) => !e.skipped).reduce((n, e) => n + (e.cardio ? (e.cardio.done ? 0 : 1) : e.sets.filter((s) => !s.done).length), 0);
  const target = open && open.kind !== "add" ? exs.find((e) => e.id === open.ex) : null;

  const addExercise = (name: string) => {
    const e: LiveExercise = {
      id: `tmp-${crypto.randomUUID()}`, name, muscleGroups: "", block: "strength", pairGroup: null, unit: "total", restSec: 90, cue: null,
      whyTarget: null, added: true, swappedFrom: null, skipped: false, skipReason: null, cardio: null, tags: [],
      sets: [{ id: crypto.randomUUID(), setType: "working", weightLbs: null, reps: null, rir: null, durationSec: null, distanceYd: null, done: false, targetRir: null }],
    };
    act({ t: "addExercise", exercise: e });
  };

  return (
    <main className="mx-auto max-w-xl pb-28 text-[var(--color-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-bold">{meta.name ?? "Workout"}</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {mmss(elapsed)} elapsed ·{" "}
              <span role="status">{sync.pending === 0 ? "Saved" : sync.offline ? `Offline, ${sync.pending} saved on phone` : `Saving ${sync.pending}…`}</span>
            </div>
          </div>
          <button type="button" className={`${btnAccent} px-4`} onClick={() => { if (unlogged === 0 || window.confirm(`${unlogged} set${unlogged === 1 ? "" : "s"} not logged. Finish anyway?`)) setStage("checkout"); }}>Finish</button>
        </div>
        {live.rest && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border-2 border-[var(--color-accent)] p-2" role="timer" aria-label="Rest timer">
            <div className="flex-1 text-3xl font-bold tabular-nums">Rest {mmss(restLeft)}</div>
            <button type="button" className={`${btn} px-3 text-sm`} onClick={() => act({ t: "addRest", sec: 30, now: Date.now() })}>+30s</button>
            <button type="button" className={`${btn} px-3 text-sm`} onClick={() => act({ t: "clearRest" })}>Skip</button>
          </div>
        )}
      </header>

      <div className="space-y-4 px-4 pt-4">
        {err && <p role="alert" className="rounded-xl border border-[var(--color-border)] p-3 text-sm">{err} <button className="underline" onClick={() => setErr(null)}>Dismiss</button></p>}
        {meta.phase === "recorded" && (
          <div className="rounded-xl border border-[var(--color-border)] p-3 text-sm">
            Editing a finished workout. Changes save as you go.{" "}
            <button className="underline" onClick={() => void runReview()}>{meta.reviewed || review ? "Update coach review" : "Get coach review"}</button>
            {updating && " Updating…"}
          </div>
        )}
        {cur && (
          <ExerciseCard key={cur.id} ex={cur} label={labels[live.current]} act={act} canUp={live.current > 0} canDown={live.current < exs.length - 1}
            onSkip={() => setOpen({ kind: "skip", ex: cur.id })} onSwap={() => setOpen({ kind: "swap", ex: cur.id })} onTag={() => setOpen({ kind: "tag", ex: cur.id })} />
        )}
        {next && (
          <button type="button" className={`${btn} flex w-full items-center justify-between px-4 text-left`} onClick={() => act({ t: "focus", index: exs.indexOf(next) })}>
            <span><span className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Up next</span><br />{labels[exs.indexOf(next)] ? `${labels[exs.indexOf(next)]} · ` : ""}{next.name}</span>
            <span aria-hidden>›</span>
          </button>
        )}
        <details className="rounded-xl border border-[var(--color-border)]">
          <summary className="flex min-h-[48px] cursor-pointer items-center px-4 font-bold">All exercises ({exs.length})</summary>
          <ul className="divide-y divide-[var(--color-border)]">
            {exs.map((e, i) => {
              const done = e.cardio ? e.cardio.done : e.sets.length > 0 && e.sets.every((s) => s.done);
              return (
                <li key={e.id}>
                  <button type="button" className="flex min-h-[48px] w-full items-center justify-between px-4 text-left" onClick={() => act({ t: "focus", index: i })}>
                    <span className={i === live.current ? "font-bold" : ""}>{labels[i] ? `${labels[i]} · ` : ""}{e.name}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{e.skipped ? `skipped${e.skipReason ? ` (${e.skipReason})` : ""}` : done ? "done" : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
        <button type="button" className={`${btn} w-full`} onClick={() => setOpen({ kind: "add" })}>+ Add exercise</button>
        <p className="text-center text-xs text-[var(--color-text-faint)]"><Link href={`/sessions/${id}`} className="underline">Plan view</Link> · <Link href={`/sessions/${id}/print`} className="underline">Print sheet</Link></p>
      </div>

      {open?.kind === "skip" && target && <SkipSheet name={target.name} onSkip={(reason) => act({ t: "skip", ex: target.id, reason })} onClose={() => setOpen(null)} />}
      {open?.kind === "swap" && target && <SwapSheet name={target.name} prefs={prefs} onSwap={(name) => act({ t: "swap", ex: target.id, name })} onClose={() => setOpen(null)} />}
      {open?.kind === "add" && <AddExerciseSheet prefs={prefs} onAdd={addExercise} onClose={() => setOpen(null)} />}
      {open?.kind === "tag" && target && (
        <FeedbackSheet sessionId={id} exerciseId={queue.current?.mapId(target.id) ?? target.id} exerciseName={target.name}
          onTagged={(tag) => act({ t: "tag", ex: target.id, tag })} onSwap={(name) => act({ t: "swap", ex: target.id, name })} onClose={() => setOpen(null)} />
      )}
      {stage === "checkout" && (
        <CheckOutSheet busy={false} hasConditioning={meta.hasConditioning} lastBodyweight={meta.lastBw} onClose={() => setStage("live")} onSubmit={(d) => void finish(d)} />
      )}
    </main>
  );
}
