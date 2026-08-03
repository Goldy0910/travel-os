import type {
  ConversationMemoryFields,
  DiscoveryPhase,
} from "@/lib/chat/memory-types";
import { formatMemoryForPrompt } from "@/lib/chat/memory-types";
import { CURRENCY_INR_INSTRUCTION } from "@/lib/chat/prompt-shared";
import {
  formatTripMemoryForPrompt,
  type TripMemoryFields,
} from "@/lib/trip-memory/types";
import {
  formatUserTravelMemoryForPrompt,
  type UserTravelMemoryFields,
} from "@/lib/user-travel-memory/types";

export type DiscoveryFieldKey =
  | "budget"
  | "travel_duration"
  | "interests"
  | "weather_preference"
  | "visa_preference"
  | "travel_dates"
  | "group_size";

const DISCOVERY_CUES: RegExp[] = [
  /\bdon'?t know where\b/i,
  /\bno idea where\b/i,
  /\bwhere should i (go|travel|visit)\b/i,
  /\bhelp me (pick|choose|find|decide)\b/i,
  /\bsuggest (a |some )?(destination|place|country|city)/i,
  /\bfind (me )?(a )?(destination|place|trip)\b/i,
  /\bundecided\b/i,
  /\bnot sure where\b/i,
  /\bopen to (anywhere|suggestions)\b/i,
  /\bdiscover(y)?\b/i,
];

const TRIP_PLANNING_CUES: RegExp[] = [
  /\b(trip|travel|vacation|holiday|getaway|honeymoon)\b/i,
  /\bwhere to go\b/i,
  /\bplan(ning)?\b/i,
];

export function detectDiscoveryIntent(input: {
  message: string;
  memory: ConversationMemoryFields;
}): boolean {
  if (input.memory.discovery_active) return true;
  const text = input.message.trim();
  if (!text) return false;
  if (DISCOVERY_CUES.some((re) => re.test(text))) return true;

  // Early planning talk without a destination → enter discovery.
  if (
    !input.memory.preferred_destination &&
    TRIP_PLANNING_CUES.some((re) => re.test(text))
  ) {
    return true;
  }
  return false;
}

export function getMissingDiscoveryFields(
  memory: ConversationMemoryFields,
): DiscoveryFieldKey[] {
  const missing: DiscoveryFieldKey[] = [];
  if (!memory.budget) missing.push("budget");
  if (!memory.travel_duration && !memory.travel_dates) missing.push("travel_duration");
  if (memory.interests.length === 0) missing.push("interests");
  if (!memory.weather_preference) missing.push("weather_preference");
  if (!memory.visa_preference) missing.push("visa_preference");
  if (!memory.group_size) missing.push("group_size");
  return missing;
}

export function resolveDiscoveryPhase(
  memory: ConversationMemoryFields,
): DiscoveryPhase {
  if (!memory.discovery_active) {
    return memory.preferred_destination ? "complete" : "idle";
  }
  if (memory.preferred_destination) return "complete";

  const missing = getMissingDiscoveryFields(memory);
  // Need enough signal before suggesting places.
  const coreMissing = missing.filter((k) =>
    ["budget", "travel_duration", "interests"].includes(k),
  );
  if (coreMissing.length > 0 || missing.length >= 3) return "gathering";

  if (memory.candidate_destinations.length === 0) return "narrowing";
  return "shortlist";
}

export function applyDiscoveryState(
  memory: ConversationMemoryFields,
  userMessage: string,
): ConversationMemoryFields {
  const intent = detectDiscoveryIntent({ message: userMessage, memory });
  const next: ConversationMemoryFields = {
    ...memory,
    discovery_active: memory.discovery_active || intent,
  };

  next.discovery_phase = resolveDiscoveryPhase(next);

  // Destination locked and user isn't re-opening discovery → leave discovery mode.
  if (next.discovery_phase === "complete" && next.preferred_destination && !intent) {
    next.discovery_active = false;
  }

  return next;
}

function phaseInstructions(phase: DiscoveryPhase, missing: DiscoveryFieldKey[]): string {
  const askMap: Record<DiscoveryFieldKey, string> = {
    budget: "budget range in INR / ₹ (total or per person)",
    travel_duration: "trip length (or rough travel dates)",
    interests: "top interests (e.g. beaches, food, hiking, culture, nightlife)",
    weather_preference: "weather preference (warm, mild, cold, dry, avoid monsoon, etc.)",
    visa_preference: "visa preference (visa-free, easy e-visa, any OK, etc.)",
    travel_dates: "travel dates or season",
    group_size: "group size / travel companions",
  };

  if (phase === "gathering") {
    const nextAsk = missing[0] ? askMap[missing[0]] : "one missing preference";
    return `Phase: GATHERING preferences.
Ask ONE focused follow-up question about: ${nextAsk}.
You may briefly acknowledge what you already know.
Do NOT recommend a final destination list yet unless the user insists.
Do NOT produce an itinerary, day plan, or packing list.`;
  }

  if (phase === "narrowing") {
    return `Phase: NARROWING destinations.
Using known preferences, briefly introduce 3–5 destination options.
The UI will render rich Destination Recommendation Cards (image, budget, weather, visa, flights, best months, highlights).
Keep your text short: a one-line intro + ask which options to shortlist or eliminate.
Do NOT paste long destination essays.
Do NOT produce an itinerary or day-by-day plan.`;
  }

  if (phase === "shortlist") {
    return `Phase: SHORTLIST refinement.
Compare remaining candidates using budget, weather, visa ease, duration, and interests.
Destination cards may appear in the UI — keep prose concise.
Help the user pick ONE destination.
Do NOT produce an itinerary yet.`;
  }

  if (phase === "complete") {
    return `Phase: DESTINATION SELECTED.
A preferred destination is set. Stay in conversation mode.
Still do NOT generate a full itinerary unless the user explicitly asks for one later.
You may offer high-level next topics (visa overview, budget ballpark, best season) without a day plan.`;
  }

  return `Phase: IDLE.
If the user is unsure where to go, enter discovery by asking what matters most (budget, duration, interests, weather, or visa ease).
Never jump to an itinerary.`;
}

export type DiscoveryPromptLayers = {
  userTravelMemory?: UserTravelMemoryFields | null;
  tripMemory?: TripMemoryFields | null;
};

export function buildDiscoverySystemPrompt(
  memory: ConversationMemoryFields,
  layers: DiscoveryPromptLayers = {},
): string {
  const missing = getMissingDiscoveryFields(memory);
  const phase = memory.discovery_phase;

  const userBlock = `User Travel Memory (cross-trip lasting preferences — personalize with these):
${formatUserTravelMemoryForPrompt(
    layers.userTravelMemory ?? {
      favorite_destinations: [],
      hotel_type: null,
      budget_range: null,
      travel_style: null,
      preferred_airlines: [],
      preferred_food: [],
      travel_pace: null,
    },
  )}`;

  const tripBlock = layers.tripMemory
    ? `\n\nTrip Memory (this trip only — do not treat as lasting user prefs):
${formatTripMemoryForPrompt(layers.tripMemory)}`
    : "";

  return `You are Travel Buddy — Discovery Agent for Travel Till 99.
Your job is to help travelers who do not know their destination yet.
Stay energetic and concise (Travel Buddy voice), but never break the hard rules below.

Hard rules:
- NEVER generate an itinerary, day-by-day plan, schedule, or timed activity list in this mode.
- NEVER create trips, book anything, or claim trip data was saved.
- First narrow down destinations. Itineraries come later only after the user clearly asks and a destination is chosen.
- Ask concise follow-up questions (usually ONE at a time). Do not interrogate with a stack of questions.
- If enough prefs already exist, recommend / shortlist instead of asking more.
- Perform light budget analysis in plain language when budget is discussed (what region/tier fits; no fake precise prices). Always discuss budgets and costs in Indian Rupees (INR / ₹), not US dollars, unless the user explicitly asks for another currency.
- Consider weather preferences, visa preferences, travel duration, and interests when ranking destinations.
- Prefer practical, popular-but-not-generic suggestions that fit the constraints.
- When listing options, give top picks with a one-line why (not bare names).
- Use light Markdown when listing options.
- Personalize using User Travel Memory when present. Keep Trip Memory and Conversation Memory separate — do not merge layers.

${CURRENCY_INR_INSTRUCTION}

${phaseInstructions(phase, missing)}

${userBlock}${tripBlock}

Conversation Memory (this chat only — not a trip, not lasting user prefs):
${formatMemoryForPrompt(memory)}

Missing discovery fields: ${missing.length ? missing.join(", ") : "none (enough to narrow)"}`;
}

export function isDiscoveryAgentActive(memory: ConversationMemoryFields): boolean {
  return memory.discovery_active && memory.discovery_phase !== "idle";
}
