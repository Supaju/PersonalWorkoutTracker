import { db } from "@/lib/db";

const FOODS = [
  { name: "Chicken Breast", calories: 130, protein: 26, carbs: 0, fat: 3, serving: "4 oz" },
  { name: "Ground Beef (85/15)", calories: 240, protein: 21, carbs: 0, fat: 17, serving: "4 oz" },
  { name: "Salmon", calories: 180, protein: 25, carbs: 0, fat: 8, serving: "4 oz" },
  { name: "White Rice", calories: 200, protein: 4, carbs: 45, fat: 0, serving: "1 cup cooked" },
  { name: "Pure Protein Bar", calories: 190, protein: 20, carbs: 17, fat: 6, serving: "1 bar" },
  { name: "Whey Shake (Naked Whey + Fairlife)", calories: 380, protein: 52, carbs: 19, fat: 6, serving: "2 scoops + 12 oz milk" },
  { name: "Eggs", calories: 70, protein: 6, carbs: 0, fat: 5, serving: "1 large" },
  { name: "Broccoli", calories: 55, protein: 4, carbs: 11, fat: 1, serving: "1 cup" },
  { name: "Asparagus", calories: 27, protein: 3, carbs: 5, fat: 0, serving: "1 cup" },
  { name: "Corn", calories: 66, protein: 2, carbs: 15, fat: 1, serving: "½ cup" },
  { name: "Cottage Cheese (4%)", calories: 110, protein: 12, carbs: 5, fat: 5, serving: "½ cup" },
  { name: "Low Fat Wheat Thins", calories: 130, protein: 2, carbs: 21, fat: 4, serving: "16 crackers" },
  { name: "Potato", calories: 160, protein: 4, carbs: 37, fat: 0, serving: "1 medium baked" },
  { name: "Pasta", calories: 220, protein: 8, carbs: 43, fat: 1, serving: "1 cup cooked" },
];

export async function seedFoodsIfEmpty() {
  const count = await db.foodItem.count();
  if (count > 0) return;
  await db.foodItem.createMany({ data: FOODS });
}
