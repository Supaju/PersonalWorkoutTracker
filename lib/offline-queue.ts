// Write-ahead mutation queue, one per session. Every mutation is saved to localStorage first, then sent in order.
// Network errors and 5xx stay queued and retry (on `online`, on an interval, with backoff). 4xx drops the item
// (retrying can't help) and records it in `failed`. Set PUTs are idempotent (client uuid), so retries are safe.

export interface Mutation {
  id: string;
  /** Items with the same key that haven't started sending are coalesced (latest wins, original position kept). */
  key?: string;
  method: "PUT" | "POST" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  /** POST that creates an exercise: after success, `tempId` is mapped to the response's exercise.id in later items. */
  bindTempId?: string;
}

interface Stored { items: Mutation[]; idMap: Record<string, string> }
export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export interface QueueOpts {
  fetch?: typeof fetch;
  storage?: StorageLike | null;
  onChange?: (q: { pending: number; sending: boolean; offline: boolean }) => void;
  /** Called once after the queue drains if any response said needsReReview. */
  onReReview?: () => void;
  onDrop?: (m: Mutation, status: number) => void;
  intervalMs?: number;
}

const keyFor = (sessionId: string) => `wt-queue:${sessionId}`;
export const newId = () => crypto.randomUUID();

function defaultStorage(): StorageLike | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

export function createQueue(sessionId: string, opts: QueueOpts = {}) {
  const store = opts.storage === undefined ? defaultStorage() : opts.storage;
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  let state: Stored = { items: [], idMap: {} };
  try {
    const raw = store?.getItem(keyFor(sessionId));
    if (raw) state = { items: [], idMap: {}, ...JSON.parse(raw) };
  } catch { /* corrupt or blocked storage: start empty */ }

  let sending = false, offline = false, reReview = false, attempts = 0, timer: ReturnType<typeof setTimeout> | null = null;
  let interval: ReturnType<typeof setInterval> | null = null, inFlightId: string | null = null;
  const failed: { m: Mutation; status: number }[] = [];

  const persist = () => { try { store?.setItem(keyFor(sessionId), JSON.stringify(state)); } catch { /* quota/blocked */ } };
  const emit = () => opts.onChange?.({ pending: state.items.length, sending, offline });
  const resolve = <T,>(v: T): T => {
    let s = JSON.stringify(v);
    for (const [t, real] of Object.entries(state.idMap)) s = s.split(t).join(real);
    return JSON.parse(s) as T;
  };

  let running: Promise<void> | null = null;
  const flush = (): Promise<void> => (running ??= run().finally(() => { running = null; }));

  async function run(): Promise<void> {
    sending = true; emit();
    try {
      while (state.items.length) {
        const m = state.items[0];
        inFlightId = m.id;
        let res: Response;
        try {
          const r = resolve({ url: m.url, body: m.body });
          res = await doFetch(r.url, {
            method: m.method, headers: { "Content-Type": "application/json" },
            body: r.body === undefined ? undefined : JSON.stringify(r.body),
          });
        } catch {
          offline = true; schedule(); return;
        }
        if (res.status >= 500) { offline = true; schedule(); return; }
        offline = false; attempts = 0;
        if (res.ok) {
          let json: { needsReReview?: boolean; exercise?: { id?: string } } | null = null;
          try { json = await res.json(); } catch { /* empty body */ }
          if (json?.needsReReview) reReview = true;
          if (m.bindTempId && json?.exercise?.id) state.idMap[m.bindTempId] = json.exercise.id;
        } else {
          failed.push({ m, status: res.status });
          opts.onDrop?.(m, res.status);
        }
        state.items.shift(); inFlightId = null; persist(); emit();
      }
      if (reReview) { reReview = false; opts.onReReview?.(); }
    } finally { sending = false; inFlightId = null; emit(); }
  }

  function schedule() {
    attempts++;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void flush(); }, Math.min(30_000, 1000 * 2 ** (attempts - 1)));
  }

  return {
    enqueue(m: Mutation) {
      const at = m.key && !m.bindTempId ? state.items.findIndex((x) => x.key === m.key && x.id !== inFlightId && !x.bindTempId) : -1;
      if (at >= 0) state.items[at] = { ...m, id: state.items[at].id };
      else state.items.push(m);
      persist(); emit();
      void flush();
    },
    flush,
    pending: () => state.items.length,
    failed: () => failed,
    /** Real id for a temp exercise id once its POST has gone through. */
    mapId: (id: string) => state.idMap[id] ?? id,
    /** Retry on reconnect and on a slow interval. Returns a cleanup function. */
    start() {
      const on = () => { attempts = 0; void flush(); };
      if (typeof window !== "undefined") window.addEventListener("online", on);
      interval = setInterval(() => { if (state.items.length) void flush(); }, opts.intervalMs ?? 15_000);
      void flush();
      return () => {
        if (typeof window !== "undefined") window.removeEventListener("online", on);
        if (interval) clearInterval(interval);
        if (timer) clearTimeout(timer);
      };
    },
    clearStored() { try { store?.removeItem(keyFor(sessionId)); } catch { /* ignore */ } },
  };
}
export type OfflineQueue = ReturnType<typeof createQueue>;

/** Local snapshot of the live screen so unsent edits survive a reload (used only while the queue is non-empty). */
export function saveSnapshot(sessionId: string, snap: unknown) {
  try { defaultStorage()?.setItem(`wt-snap:${sessionId}`, JSON.stringify(snap)); } catch { /* ignore */ }
}
export function loadSnapshot<T>(sessionId: string): T | null {
  try { const r = defaultStorage()?.getItem(`wt-snap:${sessionId}`); return r ? (JSON.parse(r) as T) : null; } catch { return null; }
}
export function pendingCount(sessionId: string, storage: StorageLike | null = defaultStorage()): number {
  try { const r = storage?.getItem(keyFor(sessionId)); return r ? (JSON.parse(r) as Stored).items.length : 0; } catch { return 0; }
}
