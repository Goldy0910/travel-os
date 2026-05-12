import type { AiIntentType, AiTripContext } from "@/lib/ai/types";

export function buildIntentPrompt(input: {
  userMessage: string;
  intent: AiIntentType;
  context: AiTripContext;
}): string {
  return [
    `Intent: ${input.intent}`,
    `User message: ${input.userMessage.trim()}`,
    "Trip context JSON:",
    JSON.stringify(input.context, null, 2),
    "Response format:",
    JSON.stringify(
      { message: "", actions: [], updatedItinerary: [], reasoning: "", followUpQuestion: "" },
      null,
      2,
    ),
  ].join("\n\n");
}
