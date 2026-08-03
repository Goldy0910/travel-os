import type { ChatDestinationCard } from "@/lib/chat/destination-card-types";
import type { ItineraryEditProposal } from "@/lib/chat/itinerary-edit-types";
import type { ConversationMemory } from "@/lib/chat/memory-types";
import type { ChatPlaceCard } from "@/lib/places/types";
import type { TripMemory } from "@/lib/trip-memory/types";

export type ChatRole = "user" | "assistant" | "system";

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  /** Theme / summary line under the title in the sidebar. */
  subtitle?: string | null;
  created_at: string;
  updated_at: string;
  /** When set, conversation belongs to a trip (null/omitted = standalone). */
  trip_id?: string | null;
};

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  role: ChatRole;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ChatStreamEvent =
  | { type: "conversation"; conversation: Pick<Conversation, "id" | "title"> }
  | { type: "user_message"; message: ConversationMessage }
  | { type: "delta"; text: string }
  | { type: "assistant_message"; message: ConversationMessage }
  | { type: "recommendations"; cards: ChatDestinationCard[] }
  | { type: "place_cards"; cards: ChatPlaceCard[] }
  | { type: "itinerary_proposal"; proposal: ItineraryEditProposal }
  | { type: "title"; conversationId: string; title: string; subtitle?: string }
  | { type: "memory"; memory: ConversationMemory }
  | { type: "trip_memory"; memory: TripMemory }
  | { type: "cancelled"; message?: ConversationMessage }
  | { type: "error"; message: string }
  | { type: "done" };

export type {
  ConversationMemory,
  ChatDestinationCard,
  ChatPlaceCard,
  TripMemory,
  ItineraryEditProposal,
};
