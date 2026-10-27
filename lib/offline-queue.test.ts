import { describe, it, expect, vi } from "vitest";
import { createQueue, type StorageLike, type Mutation } from "./offline-queue";

const mem = (): StorageLike & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
};
const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 });
const put = (n: number, extra: Partial<Mutation> = {}): Mutation => ({ id: `m${n}`, method: "PUT", url: `/api/s/sets/${n}`, body: { n }, ...extra });

describe("offline queue", () => {
  it("sends in order and empties", async () => {
    const calls: string[] = [];
    const f = vi.fn(async (u: string) => { calls.push(u); return ok(); });
    const q = createQueue("s", { fetch: f as never, storage: mem() });
    q.enqueue(put(1)); q.enqueue(put(2)); q.enqueue(put(3));
    await q.flush();
    expect(calls).toEqual(["/api/s/sets/1", "/api/s/sets/2", "/api/s/sets/3"]);
    expect(q.pending()).toBe(0);
  });

  it("offline: stays queued and persisted, then drains on retry with the same request (idempotent)", async () => {
    vi.useFakeTimers();
    const storage = mem();
    let online = false;
    const seen: { u: string; b: string }[] = [];
    const f = vi.fn(async (u: string, init: RequestInit) => {
      if (!online) throw new TypeError("network");
      seen.push({ u, b: String(init.body) });
      return ok();
    });
    const q = createQueue("s", { fetch: f as never, storage });
    q.enqueue(put(1)); q.enqueue(put(2));
    await vi.advanceTimersByTimeAsync(0);
    expect(q.pending()).toBe(2);
    expect(JSON.parse(storage.data["wt-queue:s"]).items).toHaveLength(2);
    // reopen page: a fresh queue reads the stored items
    const q2 = createQueue("s", { fetch: f as never, storage });
    expect(q2.pending()).toBe(2);
    online = true;
    await q2.flush();
    expect(q2.pending()).toBe(0);
    expect(seen.map((x) => x.u)).toEqual(["/api/s/sets/1", "/api/s/sets/2"]);
    expect(seen[0].b).toBe(JSON.stringify({ n: 1 }));
    vi.useRealTimers();
  });

  it("5xx keeps the item and blocks later ones (ordering); 4xx drops it and continues", async () => {
    vi.useFakeTimers();
    const results = [500, 400, 200, 200];
    const calls: string[] = [];
    const f = vi.fn(async (u: string) => { calls.push(u); return new Response("{}", { status: results.shift() ?? 200 }); });
    const drops: number[] = [];
    const q = createQueue("s", { fetch: f as never, storage: mem(), onDrop: (_m, s) => drops.push(s) });
    q.enqueue(put(1)); q.enqueue(put(2)); q.enqueue(put(3));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["/api/s/sets/1"]);
    await vi.advanceTimersByTimeAsync(1100); // backoff retry: 1 again (400, dropped), 2, 3
    expect(drops).toEqual([400]);
    expect(calls.slice(1)).toEqual(["/api/s/sets/1", "/api/s/sets/2", "/api/s/sets/3"]);
    expect(q.pending()).toBe(0);
    vi.useRealTimers();
  });

  it("coalesces unsent items with the same key", async () => {
    vi.useFakeTimers();
    const f = vi.fn(async () => { throw new TypeError("offline"); });
    const q = createQueue("s", { fetch: f as never, storage: mem() });
    q.enqueue(put(1, { key: "set:a" }));
    q.enqueue(put(2));
    await vi.advanceTimersByTimeAsync(0);
    q.enqueue({ id: "m9", key: "set:a", method: "PUT", url: "/api/s/sets/a", body: { n: 9 } });
    expect(q.pending()).toBe(2);
    vi.useRealTimers();
  });

  it("maps temp exercise ids after the creating POST and fires onReReview once after drain", async () => {
    const calls: { u: string; b?: string }[] = [];
    const f = vi.fn(async (u: string, init: RequestInit) => {
      calls.push({ u, b: init.body as string | undefined });
      return ok(u.endsWith("/exercises") ? { exercise: { id: "real1" }, needsReReview: true } : { needsReReview: true });
    });
    const reReview = vi.fn();
    const q = createQueue("s", { fetch: f as never, storage: mem(), onReReview: reReview });
    q.enqueue({ id: "a", method: "POST", url: "/api/sessions/s/exercises", body: { name: "X" }, bindTempId: "tmp-1" });
    q.enqueue({ id: "b", method: "PUT", url: "/api/sessions/s/sets/u1", body: { exerciseId: "tmp-1", setNumber: 1 } });
    await q.flush();
    expect(JSON.parse(calls[1].b!).exerciseId).toBe("real1");
    expect(reReview).toHaveBeenCalledTimes(1);
  });

  it("survives storage that throws", async () => {
    const bad: StorageLike = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
    const f = vi.fn(async () => ok());
    const q = createQueue("s", { fetch: f as never, storage: bad });
    q.enqueue(put(1));
    await q.flush();
    expect(f).toHaveBeenCalledTimes(1);
  });
});
