import {
  buildDiscoverySystemPrompt,
  isDiscoveryAgentActive,
} from "@/lib/chat/discovery-agent";
import {
  formatCompanionContextForPrompt,
  type TripCompanionContext,
} from "@/lib/chat/trip-companion";
import { DESTINATION_KNOWLEDGE_SYSTEM_PROMPT } from "@/lib/destination-knowledge/answer";
import { formatMemoryForPrompt } from "@/lib/chat/memory-types";
import type { ConversationMemoryFields } from "@/lib/chat/memory-types";
import {
  formatTripMemoryForPrompt,
  type TripMemoryFields,
} from "@/lib/trip-memory/types";
import {
  formatUserTravelMemoryForPrompt,
  type UserTravelMemoryFields,
} from "@/lib/user-travel-memory/types";

export const STANDALONE_CHAT_SYSTEM_PROMPT = `You are a helpful travel companion for Travel Till 99.
Have a natural, plain conversation. Be concise, friendly, and practical.
Do not create trips, book anything, or claim to modify the user's trip data.
You may discuss destinations, packing, visas, budgets, and travel tips in general terms.
When the user does not know where to go, switch into discovery mode: ask follow-ups and narrow destinations before any itinerary.
Never generate an itinerary immediately when the destination is still unknown.
When useful, format answers with light Markdown (short lists, bold for key terms).
Personalize using User Travel Memory (lasting prefs across trips) when present.
Conversation Memory is this chat only. Trip Memory (if present) is for the current trip only — do not mix layers.`;

export const TRIP_COMPANION_SYSTEM_PROMPT = `You are an on-trip travel companion for Travel Till 99.
You have a live context snapshot for the traveler's current trip: day index, destination, today's itinerary, weather, local time, and nearby activity ideas.
Be concise, situational, and practical — help with "what now", timing, logistics, weather-aware tips, and nearby alternatives.
Prefer today's itinerary when answering; mention nearby options when the plan has gaps or the user wants something else.
When the user asks you to create, generate, rebuild, or replace a full day-by-day itinerary, you MUST call the generate_itinerary tool — never dump a multi-day schedule as free text.
Pass tripId from the companion context. Include preferences/pace when the user mentioned them.
If generate_itinerary returns needs_confirmation, ask the user to confirm overwrite, then call again with replaceExisting=true.
When the user asks to surgically change the plan (move/delete/add an activity, optimize the route, reduce cost, or increase relaxation), call propose_itinerary_edits — never claim the itinerary was updated until the user confirms Apply on the confirmation card (apply_itinerary_edits).
Do not invent bookings or claim you changed itinerary/expenses/docs unless a tool confirms it after the user applies changes.
When useful, format answers with light Markdown (short lists, bold for key terms).
Personalize using User Travel Memory (lasting prefs) and Trip Memory (this trip only) when present — do not mix layers.
Always read Trip Memory before responding when this is a trip chat.
Conversation Memory is this chat only.`;

export type ChatPromptMemoryLayers = {
  /** Cross-trip lasting preferences for this authenticated user. */
  userTravelMemory?: UserTravelMemoryFields | null;
  /** Trip-scoped prefs — only for the active trip; never merge into user memory. */
  tripMemory?: TripMemoryFields | null;
};

export type ChatPromptOptions = ChatPromptMemoryLayers & {
  /** Retrieved Destination Knowledge RAG context (optional). */
  knowledgeContext?: string;
  /** Prefer Destination Knowledge answering style. */
  knowledgeMode?: boolean;
  /** Live trip companion snapshot (when chatting in a trip-scoped conversation). */
  companionContext?: TripCompanionContext | null;
  /**
   * Extra retrieval-filtered trip slices from `buildChatRetrievalContext`
   * (expenses / docs / members / guide / matched itinerary). Already budget-capped.
   */
  retrievedContext?: string;
};

function formatMemoryLayersBlock(layers: ChatPromptMemoryLayers): string {
  const sections: string[] = [
    `User Travel Memory (cross-trip lasting preferences — personalize with these):
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
    )}`,
  ];

  if (layers.tripMemory) {
    sections.push(
      `Trip Memory (this trip only — do not treat as lasting user prefs):
${formatTripMemoryForPrompt(layers.tripMemory)}`,
    );
  }

  return sections.join("\n\n");
}

export function buildChatSystemPrompt(
  memory: ConversationMemoryFields,
  options: ChatPromptOptions = {},
): string {
  const knowledgeBlock = options.knowledgeContext?.trim()
    ? `\n\nRetrieved destination knowledge (RAG — cite these facts; independent from trip planning):\n${options.knowledgeContext.trim()}`
    : "";

  const retrievedBlock = options.retrievedContext?.trim()
    ? `\n\nRetrieved trip context (relevance-filtered — do not assume missing slices):\n${options.retrievedContext.trim()}`
    : "";

  const companion = options.companionContext ?? null;
  // Prefer explicitly passed tripMemory (may include same-turn auto-updates).
  const tripMemory = options.tripMemory ?? companion?.tripMemory ?? null;
  const layersBlock = formatMemoryLayersBlock({
    userTravelMemory: options.userTravelMemory,
    tripMemory,
  });
  const conversationBlock = `Conversation Memory (this chat only — not a trip, not lasting user prefs):
${formatMemoryForPrompt(memory)}`;
  const companionBlock = companion
    ? `\n\n${formatCompanionContextForPrompt({ ...companion, tripMemory: null })}`
    : "";
  // tripMemory is already in layersBlock — avoid duplicating inside companion block

  if (companion) {
    return `${TRIP_COMPANION_SYSTEM_PROMPT}

${layersBlock}

${conversationBlock}${companionBlock}${retrievedBlock}${knowledgeBlock}`;
  }

  if (options.knowledgeMode) {
    return `${DESTINATION_KNOWLEDGE_SYSTEM_PROMPT}

${layersBlock}

${conversationBlock}${retrievedBlock}${knowledgeBlock}`;
  }

  if (isDiscoveryAgentActive(memory)) {
    return `${buildDiscoverySystemPrompt(memory, {
      userTravelMemory: options.userTravelMemory,
      tripMemory,
    })}${retrievedBlock}${knowledgeBlock}`;
  }

  return `${STANDALONE_CHAT_SYSTEM_PROMPT}

${layersBlock}

${conversationBlock}${retrievedBlock}${knowledgeBlock}`;
}
