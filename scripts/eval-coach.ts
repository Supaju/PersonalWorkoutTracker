// Model-in-the-loop acceptance eval. Run: npm run eval  (needs ANTHROPIC_API_KEY, e.g. from .env.local).
// Uses prisma/eval.db only (never dev.db). Every case prints PASS/FAIL with evidence; exit 1 on any FAIL.
process.env.DATABASE_URL = "file:./eval.db";

import type { LoggedSession } from "../lib/coach/rules";
import type { SessionPlan, SessionReview, SessionType } from "../lib/coach/schemas";

const TODAY_EXT = "2026-12-07";
const W5 = 0.05; // weight tolerance

type Result = { id: string; title: string; pass: boolean; evidence: string; ms: number };
const results: Result[] = [];
const planShapes: { label: string; problems: string[] }[] = [];

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set (use node --env-file=.env.local).");
  const { db } = await import("../lib/db");
  const { ProgramStructure } = await import("../lib/coach/schemas");
  const { heavyLightStructure, upperLowerStructure } = await import("../lib/coach/structures");
  const { OWNER, OWNER_CONSIDERATIONS, OWNER_PREFERENCES, OWNER_HISTORY, EXPECTED } = await import("../lib/coach/__fixtures__/owner-oct-2026");
  const { consistentWeeks, layoffAfter } = await import("../lib/coach/__fixtures__/extensions");
  const { DEFAULT_PERSONA } = await import("../lib/coach/philosophy");
  const { planSession } = await import("../lib/coach/plan");
  const { reviewSession, answerQuestion } = await import("../lib/coach/review");
  const { runProgramReview, decideProposal } = await import("../lib/coach/program-review");
  const { runResearch } = await import("../lib/coach/research");
  const { selectSessionType } = await import("../lib/coach/rules");

  const ID = "eval-owner";

  // ── helpers ────────────────────────────────────────────────────────────────
  const hist = (before: string, inclusive = false) => OWNER_HISTORY.filter((s) => (inclusive ? s.date <= before : s.date < before));
  const named = OWNER_HISTORY as (LoggedSession & { name?: string })[];

  async function insertSession(clientId: string, versionId: string, s: LoggedSession & { name?: string }) {
    await db.workoutSession.create({
      data: {
        clientId, programVersionId: versionId, date: s.date, template: s.sessionType, sessionType: s.sessionType,
        phase: "recorded", name: s.name ?? null,
        exercises: {
          create: s.exercises.map((e, i) => ({
            name: e.name, unit: e.unit, block: e.unit === "cardio" ? "conditioning" : "strength",
            muscleGroups: e.muscleGroups.join(", "), orderIndex: i, skipped: e.skipped, skipReason: e.skipReason,
            targetReps: e.targetReps == null ? "" : String(e.targetReps),
            sets: {
              create: e.sets.map((l, j) => ({
                setNumber: j + 1, setType: l.setType, weightLbs: l.weight, reps: l.reps, rir: l.rir,
                durationSec: l.durationSec ?? null, distanceYd: l.distanceYd ?? null,
              })),
            },
          })),
        },
      },
    });
  }

  /** Fresh client from scratch (cascade delete + recreate) so every case sees exactly the history it names. */
  async function freshClient(id: string, o: {
    history: LoggedSession[]; structure?: ReturnType<typeof heavyLightStructure>; startDate?: string;
    prefs?: boolean; webResearch?: boolean; bodyweights?: { date: string; lbs: number }[];
  }) {
    await db.client.deleteMany({ where: { id } });
    const structure = ProgramStructure.parse(o.structure ?? heavyLightStructure());
    await db.client.create({
      data: {
        id, name: id, persona: DEFAULT_PERSONA, trainingDays: JSON.stringify(OWNER.trainingDays),
        defaultMinutes: OWNER.defaultMinutes, layoffDays: OWNER.layoffDays, webResearch: o.webResearch ?? true,
        profile: { create: { name: "Andrew", age: OWNER.age, gender: OWNER.gender, heightIn: OWNER.heightIn, weightLbs: OWNER.weightLbs, goals: OWNER.goals, goalNotes: OWNER.goalNotes } },
        considerations: { create: OWNER_CONSIDERATIONS },
        preferences: o.prefs ? { create: OWNER_PREFERENCES.map((p) => ({ exerciseName: p.exerciseName, kind: p.kind, substituteFor: p.substituteFor })) } : undefined,
        programs: { create: { version: 1, phase: structure.phase, startDate: o.startDate ?? "2026-10-06", reason: "eval", structure: JSON.stringify(structure) } },
        checkIns: o.bodyweights ? { create: o.bodyweights.map((b) => ({ kind: "check_out", date: b.date, bodyweightLbs: b.lbs })) } : undefined,
      },
    });
    const v = await db.programVersion.findFirstOrThrow({ where: { clientId: id } });
    for (const s of o.history) await insertSession(id, v.id, s as LoggedSession & { name?: string });
    return v.id;
  }

  const workingWeights = (plan: SessionPlan) =>
    plan.blocks.flatMap((b) => b.exercises).map((e) => ({
      name: e.name, unit: e.unit, weights: e.sets.filter((s) => s.setType === "working" && s.weight != null).map((s) => s.weight as number),
    }));
  const allEx = (plan: SessionPlan) => plan.blocks.flatMap((b) => b.exercises);
  const near = (v: number, want: number | readonly number[]) => {
    const [lo, hi] = typeof want === "number" ? [want, want] : [want[0], want[1]];
    return v >= lo * (1 - W5) && v <= hi * (1 + W5);
  };
  const names = (plan: SessionPlan) => allEx(plan).map((e) => e.name).join(", ");

  /** Plan shape rules used by every case (reported together as C8). */
  function checkShape(label: string, plan: SessionPlan) {
    const problems: string[] = [];
    if (plan.estimatedMinutes > 60) problems.push(`estimatedMinutes ${plan.estimatedMinutes} > 60`);
    for (const b of ["warmup", "conditioning", "cooldown"] as const) {
      const blk = plan.blocks.find((x) => x.block === b);
      if (!blk || blk.exercises.length === 0) problems.push(`${b} block empty/missing`);
    }
    planShapes.push({ label, problems });
  }

  async function run(id: string, title: string, fn: () => Promise<{ pass: boolean; evidence: string }>) {
    if (process.env.EVAL_ONLY && !process.env.EVAL_ONLY.split(",").includes(id)) return; // debugging aid: EVAL_ONLY=C12a,C12b
    const t0 = Date.now();
    let r: { pass: boolean; evidence: string };
    try { r = await fn(); } catch (e) { r = { pass: false, evidence: `ERROR: ${(e as Error).stack?.split("\n").slice(0, 3).join(" | ")}` }; }
    const res = { id, title, ...r, ms: Date.now() - t0 };
    results.push(res);
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${id}  ${title}  (${(res.ms / 1000).toFixed(1)}s)\n      ${r.evidence}`);
  }

  // ── C1: re-entry on 10/21 ─────────────────────────────────────────────────
  await run("C1", "10/21 after 13-day gap -> reentry at or below previous weights", async () => {
    await freshClient(ID, { history: hist("2026-10-21") });
    const { plan } = await planSession(ID, { date: "2026-10-21" });
    checkShape("10/21", plan);
    const lastW = (name: string) => {
      for (const s of [...hist("2026-10-21")].reverse()) {
        const e = s.exercises.find((x) => x.name.toLowerCase() === name.toLowerCase());
        const w = e?.sets.filter((x) => x.setType === "working" && x.weight != null).map((x) => x.weight as number);
        if (w?.length) return Math.max(...w);
      }
      return null;
    };
    const over: string[] = [];
    let compared = 0;
    for (const e of workingWeights(plan)) {
      const prev = lastW(e.name);
      if (prev == null) continue;
      compared++;
      if (e.weights.some((w) => w > prev)) over.push(`${e.name} ${e.weights} > ${prev}`);
    }
    return {
      pass: plan.sessionType === "reentry" && over.length === 0,
      evidence: `sessionType=${plan.sessionType}; compared ${compared} exercises with a prior logged working weight (fixture 10/06-10/08 logs carry no sets, so ${compared === 0 ? "the weight check is vacuous" : "see list"}); over=${JSON.stringify(over)}; plan: ${workingWeights(plan).map((e) => `${e.name}[${e.weights}]`).join(", ")}`,
    };
  });

  // ── C3: review of 10/21 chest press ────────────────────────────────────────
  await run("C3", "review 10/21 -> chest press 140-150 and names the 90->180 jump", async () => {
    await freshClient(ID, { history: hist("2026-10-21", true) });
    const s = await db.workoutSession.findFirstOrThrow({ where: { clientId: ID, date: "2026-10-21" } });
    const rev = await reviewSession(ID, s.id);
    const p = rev.progressions.find((x) => /chest press/i.test(x.exerciseName));
    const text = [rev.summary, ...rev.highlights, ...rev.decisionsNeeded, p?.reason ?? ""].join(" ");
    const ok = !!p && p.nextWeight != null && near(p.nextWeight, EXPECTED.chestPress10RepEstimate) && /jump|90|180|smaller/i.test(text);
    return { pass: ok, evidence: `chest press nextWeight=${p?.nextWeight}; reason="${p?.reason}"; summary="${rev.summary}"; highlights=${JSON.stringify(rev.highlights)}` };
  });

  // ── C4: 10/22 ─────────────────────────────────────────────────────────────
  await run("C4", "10/22 day after heavy full body -> light_conditioning", async () => {
    await freshClient(ID, { history: hist("2026-10-22"), prefs: true });
    const { plan } = await planSession(ID, { date: "2026-10-22" });
    checkShape("10/22", plan);
    return { pass: plan.sessionType === "light_conditioning", evidence: `sessionType=${plan.sessionType}; ${plan.name}: ${names(plan)}` };
  });

  // ── C5: 10/26 ─────────────────────────────────────────────────────────────
  await run("C5", "10/26 after missed day + 2 rest days -> heavy_fullbody (not reentry)", async () => {
    await freshClient(ID, { history: hist("2026-10-26"), prefs: true });
    const { plan } = await planSession(ID, { date: "2026-10-26" });
    checkShape("10/26", plan);
    return { pass: plan.sessionType === "heavy_fullbody", evidence: `sessionType=${plan.sessionType}; ${names(plan)}` };
  });

  // ── C2 / C6 on 10/29, then C14a / C14b on the same client ─────────────────
  let plan29: SessionPlan | null = null;
  await run("C2", "10/29: no pull-through, no Machine Chest Press, has Barbell Bench Press", async () => {
    await freshClient(ID, { history: hist("2026-10-29"), prefs: true });
    plan29 = (await planSession(ID, { date: "2026-10-29" })).plan;
    checkShape("10/29", plan29);
    const n = allEx(plan29).map((e) => e.name);
    const bad = n.filter((x) => /pull-?through/i.test(x) || /^machine chest press$/i.test(x));
    return { pass: bad.length === 0 && n.some((x) => /^barbell bench press$/i.test(x)), evidence: `banned present=${JSON.stringify(bad)}; exercises: ${n.join(", ")}` };
  });

  await run("C6", "10/29 working weights within +-5% of EXPECTED; farmer carry at 53/hand", async () => {
    if (!plan29) throw new Error("no 10/29 plan (C2 failed to produce one)");
    const ww = workingWeights(plan29);
    const lines: string[] = [], bad: string[] = [];
    for (const [name, want] of Object.entries(EXPECTED.nextAfterOct26)) {
      const e = ww.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (!e) { lines.push(`${name}: absent`); continue; }
      const top = e.weights.length ? Math.max(...e.weights) : null;
      lines.push(`${name}: ${top} (want ${JSON.stringify(want)})`);
      if (top == null || !near(top, want)) bad.push(name);
    }
    const carry = ww.find((x) => /farmer/i.test(x.name));
    const carryOk = !!carry && carry.unit === "per_hand" && carry.weights.length > 0 && carry.weights.every((w) => w === 53);
    return { pass: bad.length === 0 && carryOk, evidence: `${lines.join("; ")}; farmer carry=${carry ? `${carry.unit} ${JSON.stringify(carry.weights)}` : "ABSENT"}; outside tolerance=${JSON.stringify(bad)}` };
  });

  await run("C14a", "pre check-in quads significant -> no quad-dominant lower work, hamstring/glute shift", async () => {
    const ci = await db.checkIn.create({ data: { clientId: ID, kind: "pre", date: "2026-10-29", soreness: JSON.stringify({ quads: "significant" }), sleep: "ok", energy: "normal" } });
    const { plan } = await planSession(ID, { date: "2026-10-29", checkInId: ci.id });
    checkShape("10/29 quads sore", plan);
    const banned = allEx(plan).filter((e) => /squat|lunge|step-?up|leg extension/i.test(e.name)).map((e) => e.name);
    const lp = allEx(plan).find((e) => /leg press/i.test(e.name));
    const lpText = [lp?.cue, lp?.whyTarget, plan.coachNotes].join(" ");
    const footCue = /foot placement|high(er)? (on the platform|foot)|foot.{0,20}high|high.{0,20}foot/i.test(lpText);
    const posterior = allEx(plan).some((e) => e.muscleGroups.some((m) => /hamstring|glute/i.test(m)));
    return {
      pass: plan.sessionType === "heavy_fullbody" && banned.length === 0 && (footCue || posterior),
      evidence: `sessionType=${plan.sessionType}; banned=${JSON.stringify(banned)}; leg press cue="${lp?.cue}"; footCue=${footCue}; posterior=${posterior}; exercises: ${names(plan)}`,
    };
  });

  await run("C14b", "saved dislike (Seated Cable Row) -> never programmed again", async () => {
    await db.exercisePreference.create({ data: { clientId: ID, exerciseName: "Seated Cable Row", kind: "disliked" } });
    const { plan } = await planSession(ID, { date: "2026-10-29" });
    checkShape("10/29 dislike", plan);
    const hit = allEx(plan).filter((e) => /seated cable row/i.test(e.name)).map((e) => e.name);
    return { pass: hit.length === 0, evidence: `present=${JSON.stringify(hit)}; exercises: ${names(plan)}` };
  });

  // ── C9 + C14c: review of 10/26, then answer the bench RIR question ─────────
  let review26: SessionReview | null = null;
  await run("C9", "review 10/26 asks rir(bench), abandoned(lat pulldown), skip(farmer carry)", async () => {
    await freshClient(ID, { history: hist("2026-10-26", true), prefs: true });
    const s = await db.workoutSession.findFirstOrThrow({ where: { clientId: ID, date: "2026-10-26" } });
    review26 = await reviewSession(ID, s.id);
    const q = review26.clarifyingQuestions;
    const has = (k: string, re: RegExp) => q.some((x) => x.kind === k && re.test(x.exerciseName ?? ""));
    const got = { rir: has("rir", /bench/i), abandoned: has("abandoned", /lat pulldown/i), skip: has("skip", /farmer/i) };
    return { pass: got.rir && got.abandoned && got.skip, evidence: `${JSON.stringify(got)}; questions: ${q.map((x) => `${x.kind}/${x.exerciseName}: "${x.question}"`).join(" | ")}` };
  });

  await run("C14c", 'answer bench RIR question "Nothing left" -> next weight ~175', async () => {
    const q = await db.clarifyingQuestion.findFirst({ where: { kind: "rir", exerciseName: { contains: "Bench" }, session: { clientId: ID } } });
    if (!q) throw new Error("no bench rir question stored (C9 failed)");
    const { progression } = await answerQuestion(ID, q.id, "Nothing left");
    return { pass: !!progression && progression.nextWeight != null && near(progression.nextWeight, 175), evidence: `progression=${JSON.stringify(progression)}` };
  });

  // ── C10: program review proposes Upper/Lower after 5 consistent weeks ──────
  await run("C10", "5 consistent weeks -> pending Upper/Lower proposal; program unchanged; rejection not re-issued", async () => {
    const ext = consistentWeeks(5);
    const EID = "eval-ext";
    const v1 = await freshClient(EID, { history: ext.history, prefs: true, bodyweights: ext.bodyweights });
    const r = await runProgramReview(EID, { today: TODAY_EXT });
    if (r.proposalId === null) return { pass: false, evidence: `no proposal: ${r.reason}` };
    const p = await db.programProposal.findUniqueOrThrow({ where: { id: r.proposalId } });
    const structure = JSON.parse(p.structure);
    const obs: string[] = JSON.parse(p.observations);
    const ver = await db.programVersion.findMany({ where: { clientId: EID } });
    const unchanged = ver.length === 1 && ver[0].id === v1 && ver[0].endDate === null && ver[0].phase === "heavy_light_fullbody";
    const pre = p.status === "pending" && structure.phase === "upper_lower_4day" && obs.some((o) => /\d/.test(o)) && unchanged;
    await decideProposal(EID, p.id, "reject", "not yet");
    // The simulated "today" (Dec 2026) is ahead of the real clock: stamp the rejection onto the simulated day.
    await db.programProposal.update({ where: { id: p.id }, data: { decidedAt: new Date(`${TODAY_EXT}T12:00:00Z`) } });
    const again = await runProgramReview(EID, { today: TODAY_EXT });
    const count = await db.programProposal.count({ where: { clientId: EID } });
    return {
      pass: pre && again.proposalId === null && count === 1,
      evidence: `status=${p.status}; phase=${structure.phase}; triggers=${p.trigger}; versionUnchanged=${unchanged}; observations=${JSON.stringify(obs.slice(0, 2))}; after reject: ${JSON.stringify(again)}; proposals=${count}`,
    };
  });

  // ── C11: layoff in upper_lower_4day -> step back ───────────────────────────
  await run("C11", "3-week layoff in Upper/Lower -> proposal back to heavy_light_fullbody and reentry today", async () => {
    const l = layoffAfter(5, 21);
    const LID = "eval-layoff";
    const ul = upperLowerStructure();
    await freshClient(LID, { history: l.history, structure: ul, startDate: "2026-11-23", bodyweights: l.bodyweights });
    const sel = selectSessionType({ history: l.history, today: l.today, rotation: ul.rotation as SessionType[], minHoursBetweenHeavy: ul.minHoursBetweenHeavy, layoffDays: OWNER.layoffDays, readiness: null });
    const r = await runProgramReview(LID, { today: l.today });
    if (r.proposalId === null) return { pass: false, evidence: `no proposal: ${r.reason}; today=${l.today}; selectSessionType=${sel.sessionType}` };
    const p = await db.programProposal.findUniqueOrThrow({ where: { id: r.proposalId } });
    const structure = JSON.parse(p.structure);
    return {
      pass: structure.phase === "heavy_light_fullbody" && sel.sessionType === "reentry" && p.status === "pending",
      evidence: `today=${l.today}; phase=${structure.phase}; triggers=${p.trigger}; selectSessionType=${sel.sessionType}; recommendation="${p.recommendation.slice(0, 160)}"`,
    };
  });

  // ── C12: research ──────────────────────────────────────────────────────────
  const q = "His knees ache on step-ups, what should we change?";
  await run("C12a", "research with web on -> >=2 distinct-domain sources, seeDoctor, stored", async () => {
    await freshClient(ID, { history: hist("2026-10-29"), prefs: true, webResearch: true });
    const r = await runResearch(ID, q);
    const hosts = [...new Set(r.note.sources.map((s) => new URL(s.url).hostname.replace(/^www\./, "")))];
    const stored = r.researchNoteId ? await db.researchNote.findUnique({ where: { id: r.researchNoteId } }) : null;
    return {
      pass: r.searched && hosts.length >= 2 && r.note.seeDoctor && !!stored && r.note.applicationToClient.length > 0,
      evidence: `searched=${r.searched}; hosts=${JSON.stringify(hosts)}; seeDoctor=${r.note.seeDoctor}; stored=${!!stored}; confidence=${r.note.confidence}; application="${r.note.applicationToClient.slice(0, 200)}"`,
    };
  });
  await run("C12b", "research with web off -> still answers, says no research was run", async () => {
    await db.client.update({ where: { id: ID }, data: { webResearch: false } });
    const r = await runResearch(ID, q);
    return {
      pass: !r.searched && /^No web research was run/.test(r.note.summary) && r.note.sources.length === 0 && !!r.researchNoteId,
      evidence: `searched=${r.searched}; summary="${r.note.summary.slice(0, 200)}"; sources=${r.note.sources.length}`,
    };
  });

  // ── C8: aggregated plan-shape check ────────────────────────────────────────
  const bad = planShapes.filter((p) => p.problems.length);
  const c8 = { id: "C8", title: "every plan <= 60 min with non-empty warmup, conditioning, cooldown", pass: planShapes.length > 0 && bad.length === 0, ms: 0,
    evidence: `${planShapes.length} plans checked; problems=${JSON.stringify(bad)}` };
  results.push(c8);
  console.log(`${c8.pass ? "PASS" : "FAIL"}  C8  ${c8.title}\n      ${c8.evidence}`);

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => {
  const total = results.reduce((a, r) => a + r.ms, 0);
  console.log("\n=== Eval summary ===");
  console.log("case".padEnd(7) + "result".padEnd(8) + "secs".padEnd(7) + "title");
  for (const r of results) console.log(r.id.padEnd(7) + (r.pass ? "PASS" : "FAIL").padEnd(8) + (r.ms / 1000).toFixed(1).padEnd(7) + r.title);
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed, total runtime ${(total / 1000).toFixed(0)}s`);
  if (failed || process.exitCode) process.exit(1);
});
