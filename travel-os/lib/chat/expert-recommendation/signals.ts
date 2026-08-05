import type { ConversationMemoryFields } from "@/lib/chat/memory-types";
import type { QuizAnswers } from "@/app/find-destination/_lib/types";
import type { ExpertPreferenceSignals } from "./types";

function parseBudgetInr(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDurationDays(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("weekend") || /\b2\b/.test(lower)) return 2;
  const match = lower.match(/(\d+)\s*-?\s*(\d+)?/);
  if (match) {
    const a = Number(match[1]);
    const b = match[2] ? Number(match[2]) : a;
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.round((a + b) / 2);
  }
  if (lower.includes("week") && !lower.includes("weekend")) return 7;
  return null;
}

export function signalsFromConversationMemory(
  memory: ConversationMemoryFields,
  extras?: { mentionedDestination?: string | null },
): ExpertPreferenceSignals {
  return {
    budgetInr: parseBudgetInr(memory.budget),
    budgetLabel: memory.budget,
    durationDays: parseDurationDays(memory.travel_duration),
    durationLabel: memory.travel_duration ?? memory.travel_dates,
    interests: [...memory.interests],
    weather: memory.weather_preference,
    groupType: memory.group_size,
    foodPreferences: [...memory.food_preferences],
    visaPreference: memory.visa_preference,
    travelMonth: memory.travel_dates,
    mentionedDestination: extras?.mentionedDestination ?? null,
  };
}

function quizDurationDays(duration: QuizAnswers["duration"]): number {
  switch (duration) {
    case "weekend":
      return 2;
    case "3-5-days":
      return 4;
    case "1-week":
      return 7;
    case "2-weeks":
      return 14;
    default:
      return 18;
  }
}

export function signalsFromQuizAnswers(answers: QuizAnswers): ExpertPreferenceSignals {
  return {
    budgetInr: answers.budgetInr,
    budgetLabel: `₹${answers.budgetInr.toLocaleString("en-IN")}`,
    durationDays: quizDurationDays(answers.duration),
    durationLabel: answers.duration,
    interests: [...answers.interests],
    weather: answers.weather === "any" ? null : answers.weather,
    groupType: answers.companion,
    region: answers.region,
    travelStyle: answers.travelStyle,
    foodPreferences: [],
    visaPreference: null,
    travelMonth: null,
    mentionedDestination: null,
  };
}
