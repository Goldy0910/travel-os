export type TripEmergencyContact = {
  name: string;
  phone?: string | null;
  relationship?: string | null;
  notes?: string | null;
};

export type TripMemory = {
  trip_id: string;
  budget: string | null;
  hotel_preference: string | null;
  food_preference: string | null;
  flight_preference: string | null;
  interests: string[];
  visited_places: string[];
  packing_preferences: string[];
  emergency_contacts: TripEmergencyContact[];
  updated_at: string;
};

export type TripMemoryFields = Omit<TripMemory, "trip_id" | "updated_at">;

export const EMPTY_TRIP_MEMORY_FIELDS: TripMemoryFields = {
  budget: null,
  hotel_preference: null,
  food_preference: null,
  flight_preference: null,
  interests: [],
  visited_places: [],
  packing_preferences: [],
  emergency_contacts: [],
};

export function emptyTripMemory(tripId: string): TripMemory {
  return {
    trip_id: tripId,
    ...EMPTY_TRIP_MEMORY_FIELDS,
    updated_at: new Date().toISOString(),
  };
}

export function tripMemoryHasValues(memory: TripMemoryFields): boolean {
  return Boolean(
    memory.budget ||
      memory.hotel_preference ||
      memory.food_preference ||
      memory.flight_preference ||
      memory.interests.length > 0 ||
      memory.visited_places.length > 0 ||
      memory.packing_preferences.length > 0 ||
      memory.emergency_contacts.length > 0,
  );
}

export function formatTripMemoryForPrompt(memory: TripMemoryFields): string {
  if (!tripMemoryHasValues(memory)) {
    return "No trip preferences captured yet.";
  }
  const lines: string[] = [];
  if (memory.budget) lines.push(`- Budget: ${memory.budget}`);
  if (memory.hotel_preference) {
    lines.push(`- Hotel preference: ${memory.hotel_preference}`);
  }
  if (memory.food_preference) {
    lines.push(`- Food preference: ${memory.food_preference}`);
  }
  if (memory.flight_preference) {
    lines.push(`- Flight preference: ${memory.flight_preference}`);
  }
  if (memory.interests.length > 0) {
    lines.push(`- Interests: ${memory.interests.join(", ")}`);
  }
  if (memory.visited_places.length > 0) {
    lines.push(`- Visited places: ${memory.visited_places.join(", ")}`);
  }
  if (memory.packing_preferences.length > 0) {
    lines.push(`- Packing preferences: ${memory.packing_preferences.join(", ")}`);
  }
  if (memory.emergency_contacts.length > 0) {
    const contacts = memory.emergency_contacts
      .map((c) => {
        const bits = [c.name];
        if (c.relationship) bits.push(`(${c.relationship})`);
        if (c.phone) bits.push(c.phone);
        if (c.notes) bits.push(`— ${c.notes}`);
        return bits.join(" ");
      })
      .join("; ");
    lines.push(`- Emergency contacts: ${contacts}`);
  }
  return lines.join("\n");
}
