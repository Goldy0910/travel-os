import type { AiIntentType } from "@/lib/ai/types";

const BASE_SYSTEM_PROMPT = `You are a real-time adaptive travel companion.
Prioritize practicality, safety, user intent, and minimal disruption.
Keep responses concise and actionable.
Return only valid JSON with keys: message, actions, updatedItinerary, reasoning, followUpQuestion.`;

const INTENT_SYSTEM_GUIDANCE: Record<AiIntentType, string> = {
  adjust_day:
    "Focus on modifying the current day with minimal breakage. Preserve confirmed and completed items.",
  recommendation:
    "Provide high-value recommendations aligned to preferences, pace, and local context.",
  logistics: "Focus on routes, timing, transit constraints, and practical execution details.",
  optimization:
    "Optimize day flow for time, fatigue, weather, and budget while preserving top priorities.",
  exploration: "Suggest discovery options with optional branches, not forced schedule changes.",
  conversational: "Answer naturally and helpfully, optionally proposing next best travel actions.",
};

export function getSystemPromptForIntent(intent: AiIntentType): string {
  return `${BASE_SYSTEM_PROMPT}\n${INTENT_SYSTEM_GUIDANCE[intent]}`;
}
