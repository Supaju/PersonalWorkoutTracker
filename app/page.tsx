import Link from "next/link";
import { db } from "@/lib/db";
import { GOAL_LABELS, type Goal } from "@/lib/types";
import { TEMPLATES, TEMPLATE_COLORS, CYCLE_ORDER, type TemplateId } from "@/lib/templates";
import { seedFoodsIfEmpty } from "@/lib/seed";

function formatHeight(totalInches: number): string {
  const ft = Math.floor(totalInches / 12);
  const inch = Math.round(totalInches % 12);
  return `${ft}'${inch}"`;
}

export default async function DashboardPage() {
  await seedFoodsIfEmpty();

  const today = new Date().toISOString().split("T")[0];

  const [profile, equipment, cycle, sessions, foodItems, mealPlan, latestReview] = await Promise.all([
    db.userProfile.findFirst(),
    db.equipment.findMany(),
    db.cycleState.findUnique({ where: { id: "singleton" } }),
    db.workoutSession.findMany({
      include: { exercises: { include: { sets: true }, orderBy: { orderIndex: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.foodItem.findMany(),
    db.mealPlan.findUnique({ where: { date: today } }),
    db.aIReview.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  const currentTemplate = (cycle?.currentTemplate ?? "upper_b") as TemplateId;
  const tmpl = TEMPLATES[currentTemplate];
  const colorClass = TEMPLATE_COLORS[currentTemplate];

  const pendingSession = sessions.find((s) => s.template === currentTemplate && s.phase === "planned");
  const lastRecorded = sessions.find((s) => s.phase === "recorded");

  const mealEntries = mealPlan ? (JSON.parse(mealPlan.meals) as { slot: string; foodItemId: string; quantity: number }[]) : [];
  const mealTotals = mealEntries.reduce(
    (acc, entry) => {
      const food = foodItems.find((f) => f.id === entry.foodItemId);
      if (!food) return acc;
      return { calories: acc.calories + food.calories, protein: acc.protein + food.protein, carbs: acc.carbs + food.carbs, fat: acc.fat + food.fat };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const setupSteps = [
    { href: "/profile", label: "Set up profile", done: !!profile },
    { href: "/equipment", label: "Add equipment", done: equipment.length > 0 },
    { href: "/sessions/plan", label: "Plan your first session", done: sessions.length > 0 },
    { href: "/meals", label: "Review food library", done: true },
    { href: "/ai-review", label: "Run first AI review", done: !!latestReview },
  ];
  const allDone = setupSteps.every((s) => s.done);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">
          {profile?.name ? `Welcome back, ${profile.name}` : "Welcome to WorkoutTracker"}
        </h2>
        <p className="text-slate-500 text-sm mt-1">{today}</p>
      </div>

      {!allDone && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">Getting started</h3>
          <div className="space-y-2">
            {setupSteps.map((step) => (
              <Link key={step.href} href={step.href} className="flex items-center gap-3 text-sm group">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.done ? "bg-green-500 text-white" : "bg-white border-2 border-amber-300"}`}>
                  {step.done && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className={step.done ? "text-slate-400 line-through" : "text-amber-900 group-hover:text-amber-700"}>{step.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Cycle position + CTA */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Next Session</h3>
            <Link href="/sessions" className="text-xs text-indigo-600 hover:text-indigo-800">History</Link>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${colorClass}`}>{tmpl.label}</span>
            <span className="text-sm text-slate-500">is up next</span>
          </div>

          {/* Cycle progress dots */}
          <div className="flex gap-2 mb-5">
            {CYCLE_ORDER.map((t) => (
              <div key={t} className="flex-1 text-center">
                <div className={`h-1.5 rounded-full mb-1 ${t === currentTemplate ? "bg-indigo-500" : "bg-slate-200"}`} />
                <span className="text-xs text-slate-400">{TEMPLATES[t].label}</span>
              </div>
            ))}
          </div>

          {pendingSession ? (
            <Link
              href={`/sessions/${pendingSession.id}/record`}
              className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              Continue Recording →
            </Link>
          ) : (
            <Link
              href="/sessions/plan"
              className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              Plan This Session →
            </Link>
          )}
        </div>

        {/* Profile summary */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Profile</h3>
            <Link href="/profile" className="text-xs text-indigo-600 hover:text-indigo-800">Edit</Link>
          </div>
          {profile ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Goal</dt><dd className="font-medium text-slate-800">{GOAL_LABELS[profile.goals as Goal] ?? profile.goals}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Age / Gender</dt><dd className="font-medium text-slate-800">{profile.age} / {profile.gender}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Height</dt><dd className="font-medium text-slate-800">{formatHeight(profile.heightIn)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Weight</dt><dd className="font-medium text-slate-800">{profile.weightLbs} lbs</dd></div>
            </dl>
          ) : (
            <Link href="/profile" className="text-sm text-indigo-600 hover:underline">Set up your profile →</Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Last session */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Last Session</h3>
            <Link href="/sessions" className="text-xs text-indigo-600 hover:text-indigo-800">All sessions</Link>
          </div>
          {lastRecorded ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TEMPLATE_COLORS[lastRecorded.template as TemplateId]}`}>
                  {TEMPLATES[lastRecorded.template as TemplateId]?.label}
                </span>
                <span className="text-xs text-slate-400">{lastRecorded.date}</span>
              </div>
              <ul className="space-y-1">
                {lastRecorded.exercises.slice(0, 4).map((ex) => {
                  const topSet = ex.sets.sort((a, b) => b.weightLbs - a.weightLbs)[0];
                  return (
                    <li key={ex.id} className="flex justify-between text-sm">
                      <span className="text-slate-700">{ex.name}</span>
                      {topSet && <span className="text-slate-400 text-xs">{topSet.weightLbs} lbs × {topSet.reps}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No recorded sessions yet.</p>
          )}
        </div>

        {/* Nutrition or AI notes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">{mealEntries.length > 0 ? "Today's Nutrition" : "AI Notes"}</h3>
            <Link href={mealEntries.length > 0 ? "/meals" : "/ai-review"} className="text-xs text-indigo-600 hover:text-indigo-800">
              {mealEntries.length > 0 ? "Plan" : "Full review"}
            </Link>
          </div>
          {mealEntries.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Calories", value: Math.round(mealTotals.calories), unit: "kcal", color: "text-indigo-700" },
                { label: "Protein", value: Math.round(mealTotals.protein), unit: "g", color: "text-green-700" },
                { label: "Carbs", value: Math.round(mealTotals.carbs), unit: "g", color: "text-orange-700" },
                { label: "Fat", value: Math.round(mealTotals.fat), unit: "g", color: "text-rose-700" },
              ].map(({ label, value, unit, color }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}<span className="text-xs font-normal ml-0.5">{unit}</span></p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          ) : latestReview ? (
            <p className="text-sm text-slate-600 leading-relaxed line-clamp-6">
              {latestReview.reviewText.slice(0, 300)}{latestReview.reviewText.length > 300 && "..."}
            </p>
          ) : (
            <div className="text-sm text-slate-400">
              <p className="mb-2">No AI review yet.</p>
              <Link href="/ai-review" className="text-indigo-600 hover:underline">Run your first review →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
