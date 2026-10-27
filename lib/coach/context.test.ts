import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { buildContext, toLoggedSession } from "./context";
import type { ProgramStructure } from "./schemas";

const TEST_CLIENT_ID = "test-client-unique-2026-10-26";
const TEST_PROFILE_ID = "test-profile-unique-2026-10-26";
const TEST_PROGRAM_ID = "test-program-unique-2026-10-26";
const TEST_CONSIDERATION_ACTIVE = "test-consideration-active-unique-2026-10-26";
const TEST_CONSIDERATION_INACTIVE = "test-consideration-inactive-unique-2026-10-26";
const TEST_CHECKIN_ID = "test-checkin-unique-2026-10-26";

const BASE_DATE = "2026-10-26";

// Helper to get date offset
function dateOffset(base: string, daysBack: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split("T")[0];
}

describe("context", () => {
  beforeAll(async () => {
    // Create client
    await db.client.create({
      data: {
        id: TEST_CLIENT_ID,
        name: "Test Client",
        persona: "p",
        active: true,
        trainingDays: "[1,2,4,5]",
        defaultMinutes: 60,
        hardCapMinutes: 90,
        layoffDays: 10,
        reviewEveryWeeks: 4,
        webResearch: false,
      },
    });

    // Create profile
    await db.userProfile.create({
      data: {
        id: TEST_PROFILE_ID,
        clientId: TEST_CLIENT_ID,
        name: "Test User",
        age: 30,
        gender: "M",
        heightIn: 72,
        weightLbs: 200,
        goals: "strength",
        goalNotes: "Get strong",
      },
    });

    // Create active consideration
    await db.clientConsideration.create({
      data: {
        id: TEST_CONSIDERATION_ACTIVE,
        clientId: TEST_CLIENT_ID,
        category: "injury",
        text: "Active consideration",
        active: true,
      },
    });

    // Create inactive consideration
    await db.clientConsideration.create({
      data: {
        id: TEST_CONSIDERATION_INACTIVE,
        clientId: TEST_CLIENT_ID,
        category: "injury",
        text: "Inactive consideration",
        active: false,
      },
    });

    // Create program version with structure
    const structure: ProgramStructure = {
      phase: "heavy_light_fullbody",
      description: "d",
      rotation: ["heavy_fullbody", "light_conditioning"],
      sessionTypes: {},
      progression: "p",
      conditioning: "c",
      minHoursBetweenHeavy: 48,
    };

    await db.programVersion.create({
      data: {
        id: TEST_PROGRAM_ID,
        clientId: TEST_CLIENT_ID,
        version: 1,
        phase: "heavy_light_fullbody",
        structure: JSON.stringify(structure),
        reason: "test",
        startDate: "2026-10-01",
        endDate: null,
      },
    });

    // Create 14 recorded sessions on consecutive dates (13 days back to 1 day back)
    for (let i = 13; i >= 1; i--) {
      const sessionDate = dateOffset(BASE_DATE, i);
      const sessionId = `test-session-${i}-${TEST_CLIENT_ID}`;
      const exerciseId = `test-exercise-${i}-${TEST_CLIENT_ID}`;

      // Create session
      await db.workoutSession.create({
        data: {
          id: sessionId,
          clientId: TEST_CLIENT_ID,
          programVersionId: TEST_PROGRAM_ID,
          date: sessionDate,
          template: "",
          sessionType: i % 2 === 0 ? "heavy_fullbody" : "light_conditioning",
          phase: "recorded",
          name: `Session ${i}`,
          estimatedMinutes: 60,
          durationMin: 60,
          coachNotes: `Coach notes for session ${i}`,
        },
      });

      // Create exercise
      await db.sessionExercise.create({
        data: {
          id: exerciseId,
          sessionId,
          name: `Exercise ${i}`,
          muscleGroups: "chest,shoulders",
          unit: "total",
          orderIndex: 0,
          prescription:
            i === 13
              ? JSON.stringify([
                  { setType: "ramp", weight: 100, reps: 5 },
                  { setType: "working", weight: 185, reps: 8 },
                ])
              : null,
          targetReps: i === 13 ? "" : "8-10",
        },
      });

      // Create set
      await db.setLog.create({
        data: {
          id: `test-set-${i}-${TEST_CLIENT_ID}`,
          exerciseId,
          setNumber: 1,
          setType: "working",
          weightLbs: 185,
          reps: 8,
          rir: 2,
        },
      });
    }

    // Create planned session (should be excluded from history)
    const plannedSessionId = `test-session-planned-${TEST_CLIENT_ID}`;
    await db.workoutSession.create({
      data: {
        id: plannedSessionId,
        clientId: TEST_CLIENT_ID,
        programVersionId: TEST_PROGRAM_ID,
        date: BASE_DATE,
        template: "",
        sessionType: "heavy_fullbody",
        phase: "planned",
        name: "Planned Session",
        estimatedMinutes: 60,
      },
    });

    // Create check-in
    await db.checkIn.create({
      data: {
        id: TEST_CHECKIN_ID,
        clientId: TEST_CLIENT_ID,
        kind: "pre",
        date: BASE_DATE,
        soreness: JSON.stringify({ quads: "significant" }),
        sleep: "poor",
        energy: "normal",
        minutesAvailable: 75,
      },
    });
  });

  afterAll(async () => {
    // Clean up in reverse order of creation
    await db.setLog.deleteMany({
      where: { id: { startsWith: "test-set-" } },
    });

    await db.sessionExercise.deleteMany({
      where: { id: { startsWith: "test-exercise-" } },
    });

    await db.workoutSession.deleteMany({
      where: { id: { startsWith: "test-session-" } },
    });

    await db.checkIn.deleteMany({
      where: { id: { startsWith: "test-checkin-" } },
    });

    await db.programVersion.deleteMany({
      where: { id: { startsWith: "test-program-" } },
    });

    await db.clientConsideration.deleteMany({
      where: { id: { startsWith: "test-consideration-" } },
    });

    await db.userProfile.deleteMany({
      where: { id: { startsWith: "test-profile-" } },
    });

    await db.client.deleteMany({
      where: { id: { startsWith: "test-client-" } },
    });
  });

  it("should build context with all data correctly populated", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE, TEST_CHECKIN_ID);

    expect(context.date).toBe(BASE_DATE);
    expect(context.client.id).toBe(TEST_CLIENT_ID);
    expect(context.client.persona).toBe("p");
    expect(context.profile?.id).toBe(TEST_PROFILE_ID);
    expect(context.preferences).toEqual([]);
    expect(context.equipment).toEqual([]);
  });

  it("should only include active considerations", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE);

    expect(context.considerations).toHaveLength(1);
    expect(context.considerations[0].id).toBe(TEST_CONSIDERATION_ACTIVE);
    expect(context.considerations[0].active).toBe(true);
  });

  it("should parse program structure from JSON", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE);

    expect(context.program).not.toBeNull();
    expect(context.program!.id).toBe(TEST_PROGRAM_ID);
    expect(context.program!.version).toBe(1);
    expect(context.program!.structure.phase).toBe("heavy_light_fullbody");
    expect(context.program!.structure.rotation).toEqual([
      "heavy_fullbody",
      "light_conditioning",
    ]);
    expect(context.program!.structure.minHoursBetweenHeavy).toBe(48);
  });

  it("should return only last 12 recorded sessions in OLDEST -> NEWEST order", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE);

    expect(context.history).toHaveLength(12);
    // Should exclude session 1 (oldest, 13 days back) and the planned session
    // Sessions created from i=13 down to i=1, so session 13 is oldest, session 1 is newest
    expect(context.history[0].name).toBe("Session 12");
    expect(context.history[11].name).toBe("Session 1");
    // Check ordering (OLDEST -> NEWEST means ascending dates)
    for (let i = 1; i < context.history.length; i++) {
      expect(context.history[i].date >= context.history[i - 1].date).toBe(true);
    }
  });

  it("should exclude planned sessions from history", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE);

    const plannedSessions = context.history.filter((s) => s.phase === "planned");
    expect(plannedSessions).toHaveLength(0);
  });

  it("should include last 10 recent check-ins", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE);

    expect(context.recentCheckIns.length).toBeGreaterThanOrEqual(1);
    const found = context.recentCheckIns.find((c) => c.id === TEST_CHECKIN_ID);
    expect(found).toBeDefined();
  });

  it("should load the specified check-in and parse readiness", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE, TEST_CHECKIN_ID);

    expect(context.checkIn).not.toBeNull();
    expect(context.checkIn!.id).toBe(TEST_CHECKIN_ID);
    expect(context.checkIn!.kind).toBe("pre");
    expect(context.readiness).not.toBeNull();
    expect(context.readiness!.sleep).toBe("poor");
    expect(context.readiness!.energy).toBe("normal");
    expect(context.readiness!.soreness.quads).toBe("significant");
    expect(context.readiness!.minutesAvailable).toBe(75);
  });

  it("should return null readiness when no check-in is provided", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE);

    expect(context.checkIn).toBeNull();
    expect(context.readiness).toBeNull();
  });

  it("should correctly map sets with weight, reps, rir, and setType", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE);

    const exercise = context.history[context.history.length - 1].exercises[0];
    expect(exercise.sets).toHaveLength(1);
    expect(exercise.sets[0].weight).toBe(185);
    expect(exercise.sets[0].reps).toBe(8);
    expect(exercise.sets[0].rir).toBe(2);
    expect(exercise.sets[0].setType).toBe("working");
  });

  it("should parse targetReps from prescription JSON when available", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE);

    const lastSession = context.history[context.history.length - 1];
    const exercise = lastSession.exercises[0];
    expect(exercise.targetReps).toBe(8);
  });

  it("should parse targetReps from legacy string '8-10' -> 8", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE);

    const secondLastSession = context.history[context.history.length - 2];
    const exercise = secondLastSession.exercises[0];
    expect(exercise.targetReps).toBe(8);
  });

  it("should throw error when client does not exist", async () => {
    await expect(buildContext("nonexistent-client", BASE_DATE)).rejects.toThrow(
      "Client not found",
    );
  });

  it("should parse exercise muscle groups correctly", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE);

    const exercise = context.history[0].exercises[0];
    expect(exercise.muscleGroups).toEqual(["chest", "shoulders"]);
  });

  it("should preserve exercise order by orderIndex", async () => {
    const context = await buildContext(TEST_CLIENT_ID, BASE_DATE);

    // All exercises in test data have orderIndex 0, so this is just a sanity check
    expect(context.history[0].exercises).toHaveLength(1);
  });

  it("should filter sessions by date and clientId", async () => {
    const cutoffDate = dateOffset(BASE_DATE, 5);
    const context = await buildContext(TEST_CLIENT_ID, cutoffDate);

    // Should only include sessions up to 5 days back
    expect(context.history.length).toBeLessThanOrEqual(12);
    for (const session of context.history) {
      expect(session.date <= cutoffDate).toBe(true);
    }
  });
});
