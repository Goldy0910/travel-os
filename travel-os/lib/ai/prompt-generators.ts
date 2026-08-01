import type { AiIntentType, AiTripContext } from "@/lib/ai/types";
import { formatUserTravelMemoryForPrompt } from "@/lib/user-travel-memory/types";
import type { TripMemoryFields } from "@/lib/trip-memory/types";
import { formatTripMemoryForPrompt } from "@/lib/trip-memory/types";

export function buildIntentPrompt(input: {
  userMessage: string;
  intent: AiIntentType;
  context: AiTripContext;
  /** Optional trip-scoped memory row — kept separate from user travel memory. */
  tripMemory?: TripMemoryFields | null;
}): string {
  const { userTravelMemory, ...tripContextWithoutUserMemory } = input.context;

  const sections = [
    `Intent: ${input.intent}`,
    `User message: ${input.userMessage.trim()}`,
    `User Travel Memory (cross-trip lasting preferences — personalize with these):
${formatUserTravelMemoryForPrompt(userTravelMemory)}`,
  ];

  if (input.tripMemory) {
    sections.push(
      `Trip Memory (this trip only — do not treat as lasting user prefs):
${formatTripMemoryForPrompt(input.tripMemory)}`,
    );
  }

  sections.push(
    "Trip context JSON (trip-scoped — not user travel memory):",
    // Compact JSON avoids huge pretty-printed dumps in every assistant call.
    JSON.stringify(tripContextWithoutUserMemory),
    "Response format:",
    JSON.stringify({
      message: "",
      actions: [],
      updatedItinerary: [],
      reasoning: "",
      followUpQuestion: "",
    }),
  );

  return sections.join("\n\n");
}
