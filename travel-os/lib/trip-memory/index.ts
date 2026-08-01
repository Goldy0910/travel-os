export type {
  TripEmergencyContact,
  TripMemory,
  TripMemoryFields,
} from "@/lib/trip-memory/types";

export {
  EMPTY_TRIP_MEMORY_FIELDS,
  emptyTripMemory,
  formatTripMemoryForPrompt,
  tripMemoryHasValues,
} from "@/lib/trip-memory/types";

export {
  ensureTripMemory,
  loadTripMemory,
  mergeTripMemoryFields,
  normalizeTripMemoryRow,
  resolveTripIdForConversation,
  saveTripMemory,
  updateTripMemoryFromUserMessage,
} from "@/lib/trip-memory/memory";
