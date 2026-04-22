export type Goal =
  | "lose_weight"
  | "build_muscle"
  | "improve_endurance"
  | "maintain"
  | "athletic_performance";

export const GOAL_LABELS: Record<Goal, string> = {
  lose_weight: "Lose Weight",
  build_muscle: "Build Muscle",
  improve_endurance: "Improve Endurance",
  maintain: "Maintain Current Fitness",
  athletic_performance: "Athletic Performance",
};

export type EquipmentCategory = "machine" | "free_weight" | "bodyweight" | "cardio";

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  machine: "Machine",
  free_weight: "Free Weight",
  bodyweight: "Bodyweight",
  cardio: "Cardio",
};

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealEntry {
  slot: MealSlot;
  foodItemId: string;
  quantity: number;
  notes?: string;
}

export type SessionPhase = "planned" | "recorded";

export interface PlannedExercise {
  slot: string;
  name: string;
  muscleGroups: string;
  targetSets: number;
  targetReps: string;
  targetWeight: number | null;
  aiNotes: string | null;
}

export interface AIPlanResponse {
  sessionNotes: string;
  exercises: PlannedExercise[];
}
