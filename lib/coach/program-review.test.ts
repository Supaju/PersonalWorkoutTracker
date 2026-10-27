import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { OWNER_HISTORY } from "./__fixtures__/owner-oct-2026";
import { consistentWeeks, layoffAfter } from "./__fixtures__/extensions";
import {
  computeTrends, detectTriggers, targetPhase, proposalFingerprint, isSuppressed,
  runProgramReview, decideProposal, type TrendInput,
} from "./program-review";
import type { LoggedSession } from "./rules";
import type { ProposalOut } from "./schemas";

vi.hoisted(() => { process.env.DATABASE_URL ??= "file:./test.db"; }); // prisma/test.db; never dev.db
const mockParse = vi.fn();
vi.mock("@/lib/ai", () => ({ anthropic: { messages: { parse: (...a: unknown[]) => mockParse(...a) } } }));

const base = (over: Partial<TrendInput>): TrendInput => ({
  today: "2026-12-07", history: [], trainingDays: [1, 2, 4, 5], currentPhase: "heavy_light_fullbody",
  versionStartDate: "2026-10-06", lastReviewDate: null, reviewEveryWeeks: 4, bodyweights: [],
  considerationsAddedSince: 0, scheduleOrGoalChangedSince: false, clientRequested: false, rejected: [], ...over,
});
const review = (input: TrendInput) => {
  const trends = computeTrends(input);
  return { trends, triggers: detectTriggers(input, trends) };
};

describe("pure program review", () => {
  const ext = consistentWeeks(5);

  it("criterion 10: 5 consistent weeks → ready_to_progress + scheduled, target upper_lower_4day", () => {
    const { trends, triggers } = review(base({ history: ext.history, bodyweights: ext.bodyweights }));
    expect(trends.consecutiveConsistentWeeks).toBe(5);
    expect(trends.adherenceRate).toBe(1);
    expect(trends.stalledLifts).toEqual([]);
    expect(triggers).toContain("ready_to_progress");
    expect(triggers).toContain("scheduled");
    expect(targetPhase("heavy_light_fullbody", triggers)).toBe("upper_lower_4day");
  });

  it("rejection suppresses the same fingerprint without new evidence, not with it", () => {
    const fp = proposalFingerprint("upper_lower_4day", ["ready_to_progress", "scheduled"]);
    expect(fp).toBe("upper_lower_4day|ready_to_progress");
    const input = base({ rejected: [{ fingerprint: fp, decidedAt: "2026-11-30" }] });
    expect(isSuppressed(fp, ["ready_to_progress", "scheduled"], input)).toBe(true);
    expect(isSuppressed(fp, ["ready_to_progress", "scheduled", "new_consideration"], input)).toBe(false);
    expect(isSuppressed(fp, ["ready_to_progress", "stalled_lifts"], input)).toBe(false);
    // cooldown elapsed
    expect(isSuppressed(fp, ["ready_to_progress"], { ...input, today: "2027-01-15" })).toBe(false);
    // different fingerprint
    expect(isSuppressed("heavy_light_fullbody|scheduled", ["scheduled"], input)).toBe(false);
  });

  it("criterion 11: 3-week layoff in upper_lower_4day → setback, target heavy_light_fullbody", () => {
    const l = layoffAfter(5, 21);
    const { triggers } = review(base({
      today: l.today, history: l.history, bodyweights: l.bodyweights, currentPhase: "upper_lower_4day",
    }));
    expect(triggers).toContain("setback");
    expect(triggers).not.toContain("poor_fit");
    expect(targetPhase("upper_lower_4day", triggers)).toBe("heavy_light_fullbody");
  });

  it("OWNER_HISTORY alone on 2026-10-26 has no ready_to_progress", () => {
    const { trends, triggers } = review(base({ today: "2026-10-26", history: OWNER_HISTORY }));
    expect(trends.consecutiveConsistentWeeks).toBeLessThan(4);
    expect(triggers).not.toContain("ready_to_progress");
  });

  it("detects stalls, time skips, bodyweight change and flags", () => {
    const lift = (date: string, w: number): LoggedSession => ({
      date, sessionType: "heavy_fullbody", phase: "recorded",
      exercises: [{
        name: "Bench", unit: "total", muscleGroups: [], targetReps: 10, skipped: false, skipReason: null,
        sets: [{ setType: "working", weight: w, reps: 10, rir: 2 }],
      }, ...[1, 2, 3].map((i) => ({
        name: `Skip${i}`, unit: "total" as const, muscleGroups: [], targetReps: 10, skipped: true, skipReason: "time" as const, sets: [],
      }))],
    });
    const input = base({
      today: "2026-11-30", currentPhase: "upper_lower_4day",
      history: [lift("2026-11-17", 175), lift("2026-11-19", 175), lift("2026-11-24", 175)],
      bodyweights: [{ date: "2026-11-10", lbs: 370 }, { date: "2026-11-28", lbs: 345 }],
      considerationsAddedSince: 1, clientRequested: true, scheduleOrGoalChangedSince: true,
    });
    const { trends, triggers } = review(input);
    expect(trends.stalledLifts).toEqual([{ name: "Bench", weight: 175, exposures: 3 }]);
    expect(trends.timeSkips).toBe(9);
    expect(trends.bodyweightChangePct).toBeCloseTo(-25 / 370);
    expect(triggers).toEqual(expect.arrayContaining([
      "stalled_lifts", "poor_fit", "bodyweight_change", "new_consideration", "schedule_or_goal_change", "client_request",
    ]));
  });
});

// ─── DB (prisma/test.db, mocked model) ───────────────────────────────────────

describe("runProgramReview / decideProposal (db)", () => {
  let db: typeof import("@/lib/db").db;
  let clientId = "";
  let v1Id = "";
  const TODAY = "2026-12-07";
  const out: ProposalOut = {
    observations: ["Trained 20 of 20 planned sessions over 5 weeks (100%)."],
    recommendation: "Move to a 4-day upper/lower split.",
    rationale: "Five straight consistent weeks.",
    weekToWeek: "Upper A, Lower A, Upper B, Lower B.",
    expectedBenefit: "More volume per muscle.",
    tradeOffs: "Sessions are longer.",
    structure: {
      phase: "upper_lower_4day", description: "Upper/lower", rotation: ["upper_a", "lower_a", "upper_b", "lower_b"],
      sessionTypes: { upper_a: { label: "Upper A", focus: "push", exercisePool: ["Barbell Bench Press"] } },
      progression: "Double progression", conditioning: "Every session", minHoursBetweenHeavy: 48,
    },
  };

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    const ext = consistentWeeks(5);
    const c = await db.client.create({
      data: {
        name: "pr-test", persona: "calm",
        programs: { create: { version: 1, phase: "heavy_light_fullbody", structure: "{}", reason: "seed", startDate: "2026-10-06" } },
        sessions: {
          create: ext.history.map((s) => ({
            date: s.date, template: "legacy", sessionType: s.sessionType, phase: "recorded",
            exercises: {
              create: s.exercises.map((e, i) => ({
                name: e.name, muscleGroups: e.muscleGroups.join(","), unit: e.unit, orderIndex: i,
                targetReps: String(e.targetReps ?? ""), skipped: e.skipped, skipReason: e.skipReason,
                sets: { create: e.sets.map((x, n) => ({ setNumber: n + 1, setType: x.setType, weightLbs: x.weight, reps: x.reps, rir: x.rir })) },
              })),
            },
          })),
        },
      },
      include: { programs: true },
    });
    clientId = c.id;
    v1Id = c.programs[0].id;
  });
  afterAll(async () => {
    if (clientId) await db.client.delete({ where: { id: clientId } });
    await db.$disconnect();
  });

  it("stores a pending proposal without touching the current version, then accept/reject flows", async () => {
    mockParse.mockResolvedValue({ parsed_output: out });
    const r = await runProgramReview(clientId, { today: TODAY });
    expect(r.proposalId).toBeTruthy();
    const p = await db.programProposal.findUniqueOrThrow({ where: { id: r.proposalId as string } });
    expect(p.status).toBe("pending");
    expect(p.fingerprint).toBe("upper_lower_4day|ready_to_progress");
    expect(JSON.parse(p.observations)).toEqual(out.observations);
    expect(JSON.parse(p.trigger)).toContain("ready_to_progress");
    expect(p.rationale).toBe(out.rationale);
    expect(p.tradeOffs).toBe(out.tradeOffs);
    expect((await db.programVersion.findUniqueOrThrow({ where: { id: v1Id } })).endDate).toBeNull();
    expect(await db.programVersion.count({ where: { clientId } })).toBe(1);

    // a second review while pending is refused
    expect(await runProgramReview(clientId, { today: TODAY })).toMatchObject({ proposalId: null });

    // reject: no version change, and an immediate re-review is suppressed
    expect(await decideProposal(clientId, p.id, "reject", "not yet")).toEqual({ versionId: null });
    const rejected = await db.programProposal.findUniqueOrThrow({ where: { id: p.id } });
    expect(rejected.status).toBe("rejected");
    expect(rejected.clientResponse).toBe("not yet");
    expect(await db.programVersion.count({ where: { clientId } })).toBe(1);
    // fixture dates are in the future relative to the real clock: pretend the rejection was a week before TODAY
    await db.programProposal.update({ where: { id: p.id }, data: { decidedAt: new Date("2026-11-30T12:00:00Z") } });
    const again = await runProgramReview(clientId, { today: TODAY });
    expect(again.proposalId).toBeNull();
    expect("reason" in again && again.reason).toBeTruthy();

    // a client request is new evidence → a second proposal, which we accept
    const r2 = await runProgramReview(clientId, { today: TODAY, clientRequested: true });
    expect(r2.proposalId).toBeTruthy();
    const { versionId } = await decideProposal(clientId, r2.proposalId as string, "accept");
    const v2 = await db.programVersion.findUniqueOrThrow({ where: { id: versionId as string } });
    expect(v2).toMatchObject({ version: 2, phase: "upper_lower_4day", proposalId: r2.proposalId, endDate: null });
    expect((await db.programVersion.findUniqueOrThrow({ where: { id: v1Id } })).endDate).toBeTruthy();
    expect((await db.programProposal.findUniqueOrThrow({ where: { id: r2.proposalId as string } })).status).toBe("accepted");
  });
});
