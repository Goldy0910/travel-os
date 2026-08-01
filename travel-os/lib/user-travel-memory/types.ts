export type TravelPace = "relaxed" | "balanced" | "packed" | string;

export type UserTravelMemory = {
  user_id: string;
  favorite_destinations: string[];
  hotel_type: string | null;
  budget_range: string | null;
  travel_style: string | null;
  preferred_airlines: string[];
  preferred_food: string[];
  travel_pace: string | null;
  updated_at: string;
};

export type UserTravelMemoryFields = Omit<UserTravelMemory, "user_id" | "updated_at">;

export const EMPTY_USER_TRAVEL_MEMORY_FIELDS: UserTravelMemoryFields = {
  favorite_destinations: [],
  hotel_type: null,
  budget_range: null,
  travel_style: null,
  preferred_airlines: [],
  preferred_food: [],
  travel_pace: null,
};

export function emptyUserTravelMemory(userId: string): UserTravelMemory {
  return {
    user_id: userId,
    ...EMPTY_USER_TRAVEL_MEMORY_FIELDS,
    updated_at: new Date().toISOString(),
  };
}

export function userTravelMemoryHasValues(memory: UserTravelMemoryFields): boolean {
  return Boolean(
    memory.favorite_destinations.length > 0 ||
      memory.hotel_type ||
      memory.budget_range ||
      memory.travel_style ||
      memory.preferred_airlines.length > 0 ||
      memory.preferred_food.length > 0 ||
      memory.travel_pace,
  );
}

/**
 * Prompt block for the cross-trip user layer.
 * Keep labeled distinctly from Trip Memory and Conversation Memory.
 */
export function formatUserTravelMemoryForPrompt(memory: UserTravelMemoryFields): string {
  if (!userTravelMemoryHasValues(memory)) {
    return "No lasting cross-trip preferences saved yet.";
  }
  const lines: string[] = [];
  if (memory.favorite_destinations.length > 0) {
    lines.push(`- Favorite destinations: ${memory.favorite_destinations.join(", ")}`);
  }
  if (memory.hotel_type) lines.push(`- Hotel type: ${memory.hotel_type}`);
  if (memory.budget_range) lines.push(`- Budget range: ${memory.budget_range}`);
  if (memory.travel_style) lines.push(`- Travel style: ${memory.travel_style}`);
  if (memory.preferred_airlines.length > 0) {
    lines.push(`- Preferred airlines: ${memory.preferred_airlines.join(", ")}`);
  }
  if (memory.preferred_food.length > 0) {
    lines.push(`- Preferred food: ${memory.preferred_food.join(", ")}`);
  }
  if (memory.travel_pace) lines.push(`- Travel pace: ${memory.travel_pace}`);
  return lines.join("\n");
}
