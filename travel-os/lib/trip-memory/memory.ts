import { GEMINI_GENERATE_MODELS } from "@/lib/ai/gemini-models";
import {
  EMPTY_TRIP_MEMORY_FIELDS,
  emptyTripMemory,
  type TripEmergencyContact,
  type TripMemory,
  type TripMemoryFields,
} from "@/lib/trip-memory/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  formatTripMemoryForPrompt,
  tripMemoryHasValues,
  emptyTripMemory,
  EMPTY_TRIP_MEMORY_FIELDS,
} from "@/lib/trip-memory/types";
export type {
  TripEmergencyContact,
  TripMemory,
  TripMemoryFields,
} from "@/lib/trip-memory/types";


const TRIP_MEMORY_COLUMNS =
  "trip_id, budget, hotel_preference, food_preference, flight_preference, interests, visited_places, packing_preferences, emergency_contacts, updated_at";

type TripMemoryRow = {
  trip_id: string;
  budget: string | null;
  hotel_preference: string | null;
  food_preference: string | null;
  flight_preference: string | null;
  interests: unknown;
  visited_places: unknown;
  packing_preferences: unknown;
  emergency_contacts: unknown;
  updated_at: string;
};

function asStringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!out.some((x) => x.toLowerCase() === trimmed.toLowerCase())) {
      out.push(trimmed.slice(0, 80));
    }
  }
  return out.slice(0, max);
}

function asNullableString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed.slice(0, max);
}

function asEmergencyContacts(value: unknown): TripEmergencyContact[] {
  if (!Array.isArray(value)) return [];
  const out: TripEmergencyContact[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const name = asNullableString(row.name, 80);
    if (!name) continue;
    out.push({
      name,
      phone: asNullableString(row.phone, 40),
      relationship: asNullableString(row.relationship, 60),
      notes: asNullableString(row.notes, 160),
    });
  }
  return out.slice(0, 8);
}

function mergeStringArrays(existing: string[], incoming: string[]): string[] {
  return asStringArray([...existing, ...incoming]);
}

function mergeEmergencyContacts(
  existing: TripEmergencyContact[],
  incoming: TripEmergencyContact[],
): TripEmergencyContact[] {
  const out = [...existing];
  for (const contact of incoming) {
    const idx = out.findIndex(
      (c) =>
        c.name.toLowerCase() === contact.name.toLowerCase() &&
        (c.phone ?? "") === (contact.phone ?? ""),
    );
    if (idx >= 0) {
      out[idx] = { ...out[idx], ...contact, name: contact.name };
    } else {
      out.push(contact);
    }
  }
  return out.slice(0, 8);
}

export function normalizeTripMemoryRow(
  row: TripMemoryRow | null | undefined,
  tripId: string,
): TripMemory {
  if (!row) return emptyTripMemory(tripId);
  return {
    trip_id: row.trip_id || tripId,
    budget: asNullableString(row.budget),
    hotel_preference: asNullableString(row.hotel_preference),
    food_preference: asNullableString(row.food_preference),
    flight_preference: asNullableString(row.flight_preference),
    interests: asStringArray(row.interests),
    visited_places: asStringArray(row.visited_places),
    packing_preferences: asStringArray(row.packing_preferences),
    emergency_contacts: asEmergencyContacts(row.emergency_contacts),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export function mergeTripMemoryFields(
  current: TripMemoryFields,
  patch: Partial<TripMemoryFields>,
): TripMemoryFields {
  return {
    budget:
      patch.budget !== undefined && patch.budget !== null
        ? asNullableString(patch.budget)
        : current.budget,
    hotel_preference:
      patch.hotel_preference !== undefined && patch.hotel_preference !== null
        ? asNullableString(patch.hotel_preference)
        : current.hotel_preference,
    food_preference:
      patch.food_preference !== undefined && patch.food_preference !== null
        ? asNullableString(patch.food_preference)
        : current.food_preference,
    flight_preference:
      patch.flight_preference !== undefined && patch.flight_preference !== null
        ? asNullableString(patch.flight_preference)
        : current.flight_preference,
    interests:
      patch.interests !== undefined
        ? mergeStringArrays(current.interests, asStringArray(patch.interests))
        : current.interests,
    visited_places:
      patch.visited_places !== undefined
        ? mergeStringArrays(current.visited_places, asStringArray(patch.visited_places))
        : current.visited_places,
    packing_preferences:
      patch.packing_preferences !== undefined
        ? mergeStringArrays(
            current.packing_preferences,
            asStringArray(patch.packing_preferences),
          )
        : current.packing_preferences,
    emergency_contacts:
      patch.emergency_contacts !== undefined
        ? mergeEmergencyContacts(
            current.emergency_contacts,
            asEmergencyContacts(patch.emergency_contacts),
          )
        : current.emergency_contacts,
  };
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseTripMemoryPatch(raw: string): Partial<TripMemoryFields> {
  try {
    const parsed = JSON.parse(stripJsonFences(raw)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const patch: Partial<TripMemoryFields> = {};
    if ("budget" in parsed) patch.budget = asNullableString(parsed.budget);
    if ("hotel_preference" in parsed) {
      patch.hotel_preference = asNullableString(parsed.hotel_preference);
    }
    if ("food_preference" in parsed) {
      patch.food_preference = asNullableString(parsed.food_preference);
    }
    if ("flight_preference" in parsed) {
      patch.flight_preference = asNullableString(parsed.flight_preference);
    }
    if ("interests" in parsed) patch.interests = asStringArray(parsed.interests);
    if ("visited_places" in parsed) {
      patch.visited_places = asStringArray(parsed.visited_places);
    }
    if ("packing_preferences" in parsed) {
      patch.packing_preferences = asStringArray(parsed.packing_preferences);
    }
    if ("emergency_contacts" in parsed) {
      patch.emergency_contacts = asEmergencyContacts(parsed.emergency_contacts);
    }
    return patch;
  } catch {
    return {};
  }
}

/**
 * Extract trip preference updates from a user message and merge into current trip memory.
 */
export async function updateTripMemoryFromUserMessage(input: {
  current: TripMemoryFields;
  userMessage: string;
  signal?: AbortSignal;
}): Promise<TripMemoryFields> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return input.current;

  const prompt = `You maintain trip-scoped travel memory for a trip assistant.
Update ONLY fields clearly stated or strongly implied in the latest user message.
Do not invent values. Do not create trips or itineraries.
If a field is unchanged, omit it from the JSON.

Current trip memory JSON:
${JSON.stringify(input.current)}

Latest user message:
${input.userMessage.trim().slice(0, 2000)}

Return ONLY a JSON object with any of these keys:
budget (string),
hotel_preference (string),
food_preference (string),
flight_preference (string),
interests (string array — new items only),
visited_places (string array — places already visited / to skip),
packing_preferences (string array — new items only),
emergency_contacts (array of {name, phone?, relationship?, notes?} — new or updated contacts only).

If nothing to update, return {}.`;

  for (const model of GEMINI_GENERATE_MODELS) {
    if (input.signal?.aborted) return input.current;
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 600,
              responseMimeType: "application/json",
            },
          }),
          signal: input.signal,
        },
      );
      const data = (await response.json().catch(() => null)) as
        | {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          }
        | null;
      if (!response.ok) continue;
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!raw) continue;
      const patch = parseTripMemoryPatch(raw);
      return mergeTripMemoryFields(input.current, patch);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
    }
  }
  return input.current;
}

export async function loadTripMemory(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripMemory> {
  const { data, error } = await supabase
    .from("trip_memory")
    .select(TRIP_MEMORY_COLUMNS)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error) return emptyTripMemory(tripId);
  return normalizeTripMemoryRow(data as TripMemoryRow | null, tripId);
}

export async function ensureTripMemory(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripMemory> {
  const existing = await loadTripMemory(supabase, tripId);
  const { data: probe } = await supabase
    .from("trip_memory")
    .select("trip_id")
    .eq("trip_id", tripId)
    .maybeSingle();

  if (probe?.trip_id) return existing;

  await supabase.from("trip_memory").insert({
    trip_id: tripId,
    ...EMPTY_TRIP_MEMORY_FIELDS,
    interests: [],
    visited_places: [],
    packing_preferences: [],
    emergency_contacts: [],
  });

  return loadTripMemory(supabase, tripId);
}

export async function saveTripMemory(
  supabase: SupabaseClient,
  tripId: string,
  fields: TripMemoryFields,
): Promise<TripMemory> {
  const { data, error } = await supabase
    .from("trip_memory")
    .upsert(
      {
        trip_id: tripId,
        budget: fields.budget,
        hotel_preference: fields.hotel_preference,
        food_preference: fields.food_preference,
        flight_preference: fields.flight_preference,
        interests: fields.interests,
        visited_places: fields.visited_places,
        packing_preferences: fields.packing_preferences,
        emergency_contacts: fields.emergency_contacts,
      },
      { onConflict: "trip_id" },
    )
    .select(TRIP_MEMORY_COLUMNS)
    .single();

  if (error || !data) {
    return {
      trip_id: tripId,
      ...fields,
      updated_at: new Date().toISOString(),
    };
  }
  return normalizeTripMemoryRow(data as TripMemoryRow, tripId);
}

/** Resolve trip_id for a conversation when chatting in a trip-owned thread. */
export async function resolveTripIdForConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("trip_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) return null;
  const tripId = typeof data.trip_id === "string" ? data.trip_id.trim() : "";
  return tripId || null;
}
