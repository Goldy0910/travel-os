import { AI_INTENT_TYPES, type AiIntentType } from "@/lib/ai/types";

const INTENT_KEYWORDS: Record<AiIntentType, string[]> = {
  adjust_day: ["change", "adjust", "reschedule", "move", "swap", "shift", "today", "day"],
  recommendation: ["recommend", "best", "suggest", "must", "top", "try"],
  logistics: ["route", "transport", "how to reach", "commute", "ticket", "timing", "eta"],
  optimization: ["optimize", "improve", "faster", "efficient", "reorder", "delay"],
  exploration: ["explore", "discover", "hidden", "offbeat", "around", "nearby"],
  conversational: ["hello", "hi", "thanks", "plan", "help", "chat"],
};

export function routeIntentFromInput(input: string): AiIntentType {
  const lower = input.trim().toLowerCase();
  if (!lower) return "conversational";
  for (const intent of AI_INTENT_TYPES) {
    if (INTENT_KEYWORDS[intent].some((keyword) => lower.includes(keyword))) return intent;
  }
  return "conversational";
}
