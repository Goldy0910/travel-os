import type { AiIntentType, AiStructuredResponse } from "@/lib/ai/types";

export class AiServiceError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AiServiceError";
  }
}

export function createFallbackResponse(intent: AiIntentType): AiStructuredResponse {
  const intentHint: Record<AiIntentType, string> = {
    adjust_day: "I can help rework today if you share what needs to change.",
    recommendation: "I can suggest options if you share your vibe or priorities.",
    logistics: "I can help with transit and timing if you share your next destination.",
    optimization: "I can optimize your plan if you share your current activities and constraints.",
    exploration: "I can suggest nearby discoveries based on your location and interests.",
    conversational: "I am here to help with your trip planning questions.",
  };
  return {
    message: "I could not generate a live AI response right now.",
    actions: [],
    updatedItinerary: [],
    reasoning: "Fallback response used due to temporary AI unavailability.",
    followUpQuestion: intentHint[intent],
  };
}

export async function withRetries<T>(
  task: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<T> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 3);
  const baseDelayMs = Math.max(50, options?.baseDelayMs ?? 300);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      const sleepMs = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }
  throw new AiServiceError("AI request failed after retries", lastError);
}
