export type DiscoveryPhase =
  | "idle"
  | "gathering"
  | "narrowing"
  | "shortlist"
  | "complete";

export type ConversationMemory = {
  conversation_id: string;
  preferred_destination: string | null;
  budget: string | null;
  travel_dates: string | null;
  group_size: string | null;
  interests: string[];
  food_preferences: string[];
  transport_preference: string | null;
  weather_preference: string | null;
  visa_preference: string | null;
  travel_duration: string | null;
  discovery_active: boolean;
  discovery_phase: DiscoveryPhase;
  candidate_destinations: string[];
  updated_at: string;
};

export type ConversationMemoryFields = Omit<
  ConversationMemory,
  "conversation_id" | "updated_at"
>;

export const EMPTY_MEMORY_FIELDS: ConversationMemoryFields = {
  preferred_destination: null,
  budget: null,
  travel_dates: null,
  group_size: null,
  interests: [],
  food_preferences: [],
  transport_preference: null,
  weather_preference: null,
  visa_preference: null,
  travel_duration: null,
  discovery_active: false,
  discovery_phase: "idle",
  candidate_destinations: [],
};

export function emptyConversationMemory(conversationId: string): ConversationMemory {
  return {
    conversation_id: conversationId,
    ...EMPTY_MEMORY_FIELDS,
    updated_at: new Date().toISOString(),
  };
}

export function memoryHasValues(memory: ConversationMemoryFields): boolean {
  return Boolean(
    memory.preferred_destination ||
      memory.budget ||
      memory.travel_dates ||
      memory.group_size ||
      memory.interests.length > 0 ||
      memory.food_preferences.length > 0 ||
      memory.transport_preference ||
      memory.weather_preference ||
      memory.visa_preference ||
      memory.travel_duration ||
      memory.discovery_active ||
      memory.candidate_destinations.length > 0,
  );
}

export function formatMemoryForPrompt(memory: ConversationMemoryFields): string {
  if (!memoryHasValues(memory)) {
    return "No travel preferences captured yet for this conversation.";
  }
  const lines: string[] = [];
  if (memory.discovery_active) {
    lines.push(`- Discovery mode: active (${memory.discovery_phase})`);
  }
  if (memory.preferred_destination) {
    lines.push(`- Preferred destination: ${memory.preferred_destination}`);
  }
  if (memory.candidate_destinations.length > 0) {
    lines.push(`- Candidate destinations: ${memory.candidate_destinations.join(", ")}`);
  }
  if (memory.budget) lines.push(`- Budget: ${memory.budget}`);
  if (memory.travel_dates) lines.push(`- Travel dates: ${memory.travel_dates}`);
  if (memory.travel_duration) lines.push(`- Travel duration: ${memory.travel_duration}`);
  if (memory.group_size) lines.push(`- Group size: ${memory.group_size}`);
  if (memory.weather_preference) {
    lines.push(`- Weather preference: ${memory.weather_preference}`);
  }
  if (memory.visa_preference) lines.push(`- Visa preference: ${memory.visa_preference}`);
  if (memory.interests.length > 0) {
    lines.push(`- Interests: ${memory.interests.join(", ")}`);
  }
  if (memory.food_preferences.length > 0) {
    lines.push(`- Food preferences: ${memory.food_preferences.join(", ")}`);
  }
  if (memory.transport_preference) {
    lines.push(`- Transport preference: ${memory.transport_preference}`);
  }
  return lines.join("\n");
}
