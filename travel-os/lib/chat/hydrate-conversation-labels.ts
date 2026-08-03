import "server-only";

import {
  buildConversationLabel,
  conversationLabelIsReady,
} from "@/lib/chat/conversation-label";
import type { ConversationMemoryFields } from "@/lib/chat/memory-types";
import type { Conversation } from "@/lib/chat/types";

type MemoryRow = {
  conversation_id: string;
  preferred_destination: string | null;
  budget: string | null;
  travel_dates: string | null;
  group_size: string | null;
  interests: string[] | null;
  food_preferences: string[] | null;
  transport_preference: string | null;
  weather_preference: string | null;
  visa_preference: string | null;
  travel_duration: string | null;
  discovery_active: boolean | null;
  discovery_phase: string | null;
  candidate_destinations: string[] | null;
};

function rowToMemoryFields(row: MemoryRow): ConversationMemoryFields {
  return {
    preferred_destination: row.preferred_destination,
    budget: row.budget,
    travel_dates: row.travel_dates,
    group_size: row.group_size,
    interests: Array.isArray(row.interests) ? row.interests : [],
    food_preferences: Array.isArray(row.food_preferences) ? row.food_preferences : [],
    transport_preference: row.transport_preference,
    weather_preference: row.weather_preference,
    visa_preference: row.visa_preference,
    travel_duration: row.travel_duration,
    discovery_active: Boolean(row.discovery_active),
    discovery_phase: (row.discovery_phase as ConversationMemoryFields["discovery_phase"]) || "idle",
    candidate_destinations: Array.isArray(row.candidate_destinations)
      ? row.candidate_destinations
      : [],
  };
}

/**
 * Fill missing/default titles + subtitles from conversation_memory (no LLM).
 */
export async function hydrateConversationLabels(
  supabase: { from: (table: string) => any },
  conversations: Conversation[],
): Promise<Conversation[]> {
  if (!conversations.length) return conversations;

  const needsHydration = conversations.some((c) => {
    const title = (c.title || "").trim().toLowerCase();
    const weakTitle = !title || title === "new chat" || title === "untitled";
    const missingSubtitle = !c.subtitle?.trim();
    return weakTitle || missingSubtitle;
  });
  if (!needsHydration) return conversations;

  const ids = conversations.map((c) => c.id);
  const { data, error } = await supabase
    .from("conversation_memory")
    .select(
      "conversation_id, preferred_destination, budget, travel_dates, group_size, interests, food_preferences, transport_preference, weather_preference, visa_preference, travel_duration, discovery_active, discovery_phase, candidate_destinations",
    )
    .in("conversation_id", ids);

  if (error || !data?.length) return conversations;

  const byId = new Map<string, ConversationMemoryFields>();
  for (const row of data as MemoryRow[]) {
    byId.set(row.conversation_id, rowToMemoryFields(row));
  }

  return conversations.map((c) => {
    const memory = byId.get(c.id);
    if (!memory) return c;
    const label = buildConversationLabel(memory);
    if (!conversationLabelIsReady(label) && !label.subtitle) return c;

    const titleWeak =
      !(c.title || "").trim() ||
      ["new chat", "untitled"].includes((c.title || "").trim().toLowerCase());

    return {
      ...c,
      title: titleWeak ? label.title : c.title,
      subtitle: c.subtitle?.trim() ? c.subtitle : label.subtitle,
    };
  });
}
