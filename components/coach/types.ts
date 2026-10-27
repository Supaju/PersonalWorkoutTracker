// Shapes returned by the coach APIs, as consumed by the UI. Source of truth: lib/coach/schemas.ts and app/api/**.
import type { CoachAction } from "@/lib/coach/schemas";
export type { CoachAction };

export type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action: string | null; // JSON CoachAction; use parseAction()
  sessionId: string | null;
  proposalId: string | null;
  createdAt: string;
};

export function parseAction(raw: string | null): CoachAction | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as CoachAction; } catch { return null; }
}

export type SessionBrief = { id: string; date: string; sessionType: string; name: string | null };

export type Question = {
  id: string; sessionId: string; exerciseName: string | null; kind: string;
  question: string; options: string; // JSON string[]
  answer: string | null;
};

export type Today = {
  date: string;
  isTrainingDay: boolean;
  suggestedSessionType: string;
  reasons: string[];
  layoff: unknown;
  activeSession: SessionBrief | null;
  plannedSession: SessionBrief | null;
  lastSession: { id: string; date: string; sessionType: string; summary: string | null } | null;
  pendingQuestions: Question[];
  pendingProposals: { id: string; recommendation: string; createdAt: string }[];
  needsNextDayCheck: { areas: string[] } | null;
};

export type WeekDay = {
  date: string; weekday: number; // 0=Sun
  status: "done" | "today" | "upcoming" | "rest" | "missed";
  sessionType: string | null;
};

export const SESSION_LABEL: Record<string, string> = {
  heavy_fullbody: "Heavy full body", light_conditioning: "Light + conditioning", reentry: "Re-entry",
  upper_a: "Upper A", lower_a: "Lower A", upper_b: "Upper B", lower_b: "Lower B", deload: "Deload",
};
export const sessionLabel = (t: string | null) => (t ? SESSION_LABEL[t] ?? t.replace(/_/g, " ") : "Rest");
export const areaLabel = (a: string) => a.replace(/_/g, " ");
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** JSON fetch helper. Throws Error(message) on non-2xx. Body present → POST (override method for PATCH/DELETE). */
export async function api<T>(url: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Request failed (${r.status})`);
  return j as T;
}

/** Serializable Client row passed from server pages to settings forms. trainingDays is a parsed number[] (0=Sun). */
export type ClientSettings = {
  id: string; name: string; persona: string; trainingDays: number[];
  defaultMinutes: number; hardCapMinutes: number; layoffDays: number; reviewEveryWeeks: number; webResearch: boolean;
};

/** ProgramStructure (lib/coach/schemas.ts) as parsed from ProgramVersion.structure / ProgramProposal.structure JSON. */
export type Structure = {
  phase: string; description: string; rotation: string[];
  sessionTypes: Record<string, { label: string; focus: string; exercisePool: string[] }>;
  progression: string; conditioning: string; minHoursBetweenHeavy: number;
};
