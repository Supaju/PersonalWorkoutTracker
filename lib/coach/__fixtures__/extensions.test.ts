import { describe, it, expect } from "vitest";
import { consistentWeeks, layoffAfter } from "./extensions";
import { OWNER_HISTORY } from "./owner-oct-2026";

describe("consistentWeeks", () => {
  it("generates 5 weeks of consistent training with 20 sessions total", () => {
    const result = consistentWeeks(5);

    // Should have OWNER_HISTORY + 20 generated sessions
    expect(result.history).toHaveLength(OWNER_HISTORY.length + 20);
    expect(result.history.length).toBe(26);
  });

  it("has last session on 2026-12-04 (Fri)", () => {
    const result = consistentWeeks(5);
    const lastSession = result.history[result.history.length - 1];

    expect(lastSession.date).toBe("2026-12-04");
  });

  it("week 0 Monday Bench Press is 175 lbs", () => {
    const result = consistentWeeks(5);
    // Find first session after OWNER_HISTORY (should be Mon Nov 2)
    const week0Mon = result.history[OWNER_HISTORY.length];

    expect(week0Mon.date).toBe("2026-11-02");
    expect(week0Mon.sessionType).toBe("heavy_fullbody");

    const benchExercise = week0Mon.exercises.find(
      (ex) => ex.name === "Barbell Bench Press"
    );
    expect(benchExercise).toBeDefined();

    // First ramp set should be ~60% of working (175*0.6 = 105)
    expect(benchExercise!.sets[0].setType).toBe("ramp");
    expect(benchExercise!.sets[0].weight).toBe(105);

    // Two working sets at 175
    expect(benchExercise!.sets[1].weight).toBe(175);
    expect(benchExercise!.sets[2].weight).toBe(175);
  });

  it("week 4 Bench Press is 195 lbs", () => {
    const result = consistentWeeks(5);
    // Week 4 Monday is at index OWNER_HISTORY.length + 16 (4 sessions/week * 4 weeks)
    const week4Mon = result.history[OWNER_HISTORY.length + 16];

    expect(week4Mon.date).toBe("2026-11-30");
    expect(week4Mon.sessionType).toBe("heavy_fullbody");

    const benchExercise = week4Mon.exercises.find(
      (ex) => ex.name === "Barbell Bench Press"
    );
    expect(benchExercise).toBeDefined();

    // Working weight: 175 + 5*4 = 195
    expect(benchExercise!.sets[1].weight).toBe(195);
    expect(benchExercise!.sets[2].weight).toBe(195);
  });

  it("week 1 Leg Press is 410 lbs", () => {
    const result = consistentWeeks(5);
    // Week 1 Monday is at index OWNER_HISTORY.length + 4 (after week 0's 4 sessions)
    const week1Mon = result.history[OWNER_HISTORY.length + 4];

    expect(week1Mon.date).toBe("2026-11-09");
    expect(week1Mon.sessionType).toBe("heavy_fullbody");

    const legPressExercise = week1Mon.exercises.find(
      (ex) => ex.name === "Leg Press"
    );
    expect(legPressExercise).toBeDefined();

    // Working weight: 400 + 10*1 = 410
    expect(legPressExercise!.sets[1].weight).toBe(410);
    expect(legPressExercise!.sets[2].weight).toBe(410);
  });

  it("has 5 bodyweight entries with last being 362 lbs", () => {
    const result = consistentWeeks(5);

    expect(result.bodyweights).toHaveLength(5);

    // Week 0: 370 - 2*0 = 370
    expect(result.bodyweights[0].lbs).toBe(370);
    expect(result.bodyweights[0].date).toBe("2026-11-02");

    // Week 4: 370 - 2*4 = 362
    expect(result.bodyweights[4].lbs).toBe(362);
    expect(result.bodyweights[4].date).toBe("2026-11-30");
  });
});

describe("layoffAfter", () => {
  it("generates sessions with upper_a/lower_a/upper_b/lower_b from week 3 onwards", () => {
    const result = layoffAfter(5, 21);

    // Find sessions from week 3 (index OWNER_HISTORY.length + 12)
    const week3Start = OWNER_HISTORY.length + 12;

    const week3Mon = result.history[week3Start];
    const week3Tue = result.history[week3Start + 1];
    const week3Thu = result.history[week3Start + 2];
    const week3Fri = result.history[week3Start + 3];

    expect(week3Mon.sessionType).toBe("upper_a");
    expect(week3Tue.sessionType).toBe("lower_a");
    expect(week3Thu.sessionType).toBe("upper_b");
    expect(week3Fri.sessionType).toBe("lower_b");

    // Week 4 should follow the same pattern
    const week4Start = week3Start + 4;
    const week4Mon = result.history[week4Start];
    const week4Tue = result.history[week4Start + 1];
    const week4Thu = result.history[week4Start + 2];
    const week4Fri = result.history[week4Start + 3];

    expect(week4Mon.sessionType).toBe("upper_a");
    expect(week4Tue.sessionType).toBe("lower_a");
    expect(week4Thu.sessionType).toBe("upper_b");
    expect(week4Fri.sessionType).toBe("lower_b");
  });

  it("has last session on 2026-12-04", () => {
    const result = layoffAfter(5, 21);
    const lastSession = result.history[result.history.length - 1];

    expect(lastSession.date).toBe("2026-12-04");
  });

  it("returns today as 2026-12-26 (21 days after last session + 1)", () => {
    const result = layoffAfter(5, 21);

    expect(result.today).toBe("2026-12-26");
  });
});
