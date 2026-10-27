import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const failures: string[] = [];

  try {
    // Step 1: Find or create the test client
    let testClient = await db.client.findFirst({
      where: { name: "Test Client" },
    });

    if (!testClient) {
      testClient = await db.client.create({
        data: {
          name: "Test Client",
          persona: "Friendly test coach.",
          trainingDays: "[1,3,5]",
        },
      });
    }

    const testClientId = testClient.id;

    // Find the owner client (id = "owner")
    const ownerClient = await db.client.findUnique({
      where: { id: "owner" },
    });

    if (!ownerClient) {
      failures.push("FAIL: Owner client with id 'owner' does not exist in the database");
      await db.$disconnect();
      process.exit(1);
    }

    // Step 2: Record owner counts
    const ownerCountsBefore = {
      workoutSession: await db.workoutSession.count({
        where: { clientId: "owner" },
      }),
      sessionExercise: await db.sessionExercise.count({
        where: { session: { clientId: "owner" } },
      }),
      equipment: await db.equipment.count({ where: { clientId: "owner" } }),
      nutritionEntry: await db.nutritionEntry.count({
        where: { clientId: "owner" },
      }),
      userProfile: await db.userProfile.count({
        where: { clientId: "owner" },
      }),
      checkIn: await db.checkIn.count({ where: { clientId: "owner" } }),
      coachMessage: await db.coachMessage.count({
        where: { clientId: "owner" },
      }),
      clientConsideration: await db.clientConsideration.count({
        where: { clientId: "owner" },
      }),
      exercisePreference: await db.exercisePreference.count({
        where: { clientId: "owner" },
      }),
      programVersion: await db.programVersion.count({
        where: { clientId: "owner" },
      }),
    };

    // Step 3: Idempotently ensure test client has required data

    // Upsert UserProfile
    await db.userProfile.upsert({
      where: { clientId: testClientId },
      update: {},
      create: {
        clientId: testClientId,
        age: 40,
        gender: "female",
        heightIn: 65,
        weightLbs: 150,
        goals: "general_fitness",
      },
    });

    // Create Equipment if none exists
    const existingEquipment = await db.equipment.findFirst({
      where: { clientId: testClientId, name: "Dumbbells" },
    });
    if (!existingEquipment) {
      await db.equipment.create({
        data: {
          clientId: testClientId,
          name: "Dumbbells",
          category: "free_weights",
        },
      });
    }

    // Create NutritionEntry if none exists
    const existingNutrition = await db.nutritionEntry.findFirst({
      where: { clientId: testClientId, description: "Oatmeal" },
    });
    if (!existingNutrition) {
      await db.nutritionEntry.create({
        data: {
          clientId: testClientId,
          date: "2026-10-26",
          slot: "breakfast",
          description: "Oatmeal",
          calories: 300,
          protein: 10,
          carbs: 50,
          fat: 6,
          source: "manual",
        },
      });
    }

    // Create WorkoutSession if none exists
    const existingSession = await db.workoutSession.findFirst({
      where: { clientId: testClientId, name: "Test session" },
    });
    if (!existingSession) {
      await db.workoutSession.create({
        data: {
          clientId: testClientId,
          date: "2026-10-26",
          template: "legacy",
          name: "Test session",
          phase: "recorded",
        },
      });
    }

    // Step 4: Assert conditions

    // (a) Check owner counts haven't changed
    const ownerCountsAfter = {
      workoutSession: await db.workoutSession.count({
        where: { clientId: "owner" },
      }),
      sessionExercise: await db.sessionExercise.count({
        where: { session: { clientId: "owner" } },
      }),
      equipment: await db.equipment.count({ where: { clientId: "owner" } }),
      nutritionEntry: await db.nutritionEntry.count({
        where: { clientId: "owner" },
      }),
      userProfile: await db.userProfile.count({
        where: { clientId: "owner" },
      }),
      checkIn: await db.checkIn.count({ where: { clientId: "owner" } }),
      coachMessage: await db.coachMessage.count({
        where: { clientId: "owner" },
      }),
      clientConsideration: await db.clientConsideration.count({
        where: { clientId: "owner" },
      }),
      exercisePreference: await db.exercisePreference.count({
        where: { clientId: "owner" },
      }),
      programVersion: await db.programVersion.count({
        where: { clientId: "owner" },
      }),
    };

    const countKeys = Object.keys(ownerCountsBefore) as Array<keyof typeof ownerCountsBefore>;
    for (const key of countKeys) {
      if (ownerCountsBefore[key] !== ownerCountsAfter[key]) {
        failures.push(
          `FAIL: Owner ${key} count changed from ${ownerCountsBefore[key]} to ${ownerCountsAfter[key]}`
        );
      } else {
        console.log(`OK: Owner ${key} count unchanged (${ownerCountsBefore[key]})`);
      }
    }

    // (b) Check that owner client queries have no test client data
    const ownerSessions = await db.workoutSession.findMany({
      where: { clientId: "owner" },
    });
    if (ownerSessions.some((s) => s.name === "Test session")) {
      failures.push(
        `FAIL: Owner client has workoutSession with name 'Test session'`
      );
    } else {
      console.log(`OK: Owner workoutSession has no 'Test session'`);
    }

    const ownerEquipment = await db.equipment.findMany({
      where: { clientId: "owner" },
    });
    if (ownerEquipment.some((e) => e.name === "Dumbbells")) {
      failures.push(`FAIL: Owner client has equipment named 'Dumbbells'`);
    } else {
      console.log(`OK: Owner equipment has no 'Dumbbells'`);
    }

    const ownerNutrition = await db.nutritionEntry.findMany({
      where: { clientId: "owner" },
    });
    if (ownerNutrition.some((n) => n.description === "Oatmeal")) {
      failures.push(`FAIL: Owner client has nutritionEntry with description 'Oatmeal'`);
    } else {
      console.log(`OK: Owner nutritionEntry has no 'Oatmeal'`);
    }


    // (c) Check that test client queries return exactly 1 row each
    const testSessions = await db.workoutSession.findMany({
      where: { clientId: testClientId },
    });
    if (testSessions.length !== 1) {
      failures.push(
        `FAIL: Test client workoutSession count is ${testSessions.length}, expected 1`
      );
    } else {
      console.log(`OK: Test client has exactly 1 workoutSession`);
    }

    const testEquipment = await db.equipment.findMany({
      where: { clientId: testClientId },
    });
    if (testEquipment.length !== 1) {
      failures.push(
        `FAIL: Test client equipment count is ${testEquipment.length}, expected 1`
      );
    } else {
      console.log(`OK: Test client has exactly 1 equipment`);
    }

    const testNutrition = await db.nutritionEntry.findMany({
      where: { clientId: testClientId },
    });
    if (testNutrition.length !== 1) {
      failures.push(
        `FAIL: Test client nutritionEntry count is ${testNutrition.length}, expected 1`
      );
    } else {
      console.log(`OK: Test client has exactly 1 nutritionEntry`);
    }

    const testProfiles = await db.userProfile.findMany({
      where: { clientId: testClientId },
    });
    if (testProfiles.length !== 1) {
      failures.push(
        `FAIL: Test client userProfile count is ${testProfiles.length}, expected 1`
      );
    } else {
      console.log(`OK: Test client has exactly 1 userProfile`);
    }

    // Print all failures
    for (const failure of failures) {
      console.log(failure);
    }
  } finally {
    await db.$disconnect();
  }

  process.exit(failures.length ? 1 : 0);
}

main();
