import { GEMINI_GENERATE_MODELS } from "@/lib/ai/gemini-models";
import {
  EMPTY_USER_TRAVEL_MEMORY_FIELDS,
  emptyUserTravelMemory,
  type UserTravelMemory,
  type UserTravelMemoryFields,
} from "@/lib/user-travel-memory/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  formatUserTravelMemoryForPrompt,
  userTravelMemoryHasValues,
} from "@/lib/user-travel-memory/types";


const MEMORY_COLUMNS =
  "user_id, favorite_destinations, hotel_type, budget_range, travel_style, preferred_airlines, preferred_food, travel_pace, updated_at";

type MemoryRow = {
  user_id: string;
  favorite_destinations: unknown;
  hotel_type: string | null;
  budget_range: string | null;
  travel_style: string | null;
  preferred_airlines: unknown;
  preferred_food: unknown;
  travel_pace: string | null;
  updated_at: string;
};



function asStringArray(value: unknown): string[] {
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
  return out.slice(0, 12);
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed.slice(0, 160);
}

export function normalizeUserTravelMemoryRow(
  row: MemoryRow | null | undefined,
  userId: string,
): UserTravelMemory {
  if (!row) return emptyUserTravelMemory(userId);
  return {
    user_id: row.user_id || userId,
    favorite_destinations: asStringArray(row.favorite_destinations),
    hotel_type: asNullableString(row.hotel_type),
    budget_range: asNullableString(row.budget_range),
    travel_style: asNullableString(row.travel_style),
    preferred_airlines: asStringArray(row.preferred_airlines),
    preferred_food: asStringArray(row.preferred_food),
    travel_pace: asNullableString(row.travel_pace),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

function mergeStringArrays(existing: string[], incoming: string[]): string[] {
  return asStringArray([...existing, ...incoming]);
}

/**
 * Merge durable prefs. Arrays accumulate; scalars overwrite only when incoming is non-null.
 * Never copies trip-scoped or conversation-scoped structures.
 */
export function mergeUserTravelMemoryFields(
  current: UserTravelMemoryFields,
  patch: Partial<UserTravelMemoryFields>,
): UserTravelMemoryFields {
  return {
    favorite_destinations:
      patch.favorite_destinations !== undefined
        ? mergeStringArrays(
            current.favorite_destinations,
            asStringArray(patch.favorite_destinations),
          )
        : current.favorite_destinations,
    hotel_type:
      patch.hotel_type !== undefined && patch.hotel_type !== null
        ? asNullableString(patch.hotel_type)
        : current.hotel_type,
    budget_range:
      patch.budget_range !== undefined && patch.budget_range !== null
        ? asNullableString(patch.budget_range)
        : current.budget_range,
    travel_style:
      patch.travel_style !== undefined && patch.travel_style !== null
        ? asNullableString(patch.travel_style)
        : current.travel_style,
    preferred_airlines:
      patch.preferred_airlines !== undefined
        ? mergeStringArrays(current.preferred_airlines, asStringArray(patch.preferred_airlines))
        : current.preferred_airlines,
    preferred_food:
      patch.preferred_food !== undefined
        ? mergeStringArrays(current.preferred_food, asStringArray(patch.preferred_food))
        : current.preferred_food,
    travel_pace:
      patch.travel_pace !== undefined && patch.travel_pace !== null
        ? asNullableString(patch.travel_pace)
        : current.travel_pace,
  };
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseUserTravelMemoryPatch(raw: string): Partial<UserTravelMemoryFields> {
  try {
    const parsed = JSON.parse(stripJsonFences(raw)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const patch: Partial<UserTravelMemoryFields> = {};
    if ("favorite_destinations" in parsed) {
      patch.favorite_destinations = asStringArray(parsed.favorite_destinations);
    }
    if ("hotel_type" in parsed) patch.hotel_type = asNullableString(parsed.hotel_type);
    if ("budget_range" in parsed) patch.budget_range = asNullableString(parsed.budget_range);
    if ("travel_style" in parsed) patch.travel_style = asNullableString(parsed.travel_style);
    if ("preferred_airlines" in parsed) {
      patch.preferred_airlines = asStringArray(parsed.preferred_airlines);
    }
    if ("preferred_food" in parsed) {
      patch.preferred_food = asStringArray(parsed.preferred_food);
    }
    if ("travel_pace" in parsed) patch.travel_pace = asNullableString(parsed.travel_pace);
    return patch;
  } catch {
    return {};
  }
}

/**
 * Light auto-harvest of durable cross-trip prefs from a user message.
 * Explicitly ignores trip-only facts (dates, this-trip destination choice,
 * packing, emergency contacts, visited places, group size for one trip).
 */
export async function harvestUserTravelMemoryFromMessage(input: {
  current: UserTravelMemoryFields;
  userMessage: string;
  signal?: AbortSignal;
}): Promise<UserTravelMemoryFields> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return input.current;

  const prompt = `You maintain USER TRAVEL MEMORY — lasting preferences that apply across many trips.

Extract ONLY durable cross-trip preferences clearly stated or strongly implied.
Do NOT extract trip-only facts such as:
- specific travel dates / this trip's duration
- destination chosen for the current trip plan
- packing lists, emergency contacts, visited places on a trip
- group size for one outing
- itinerary details

Allowed fields only:
favorite_destinations (places the user generally loves / always wants to return to — NOT a one-off trip pick),
hotel_type (e.g. boutique, hostel, luxury, aparthotel),
budget_range (general spend comfort, e.g. mid-range, under $100/night),
travel_style (e.g. adventure, foodie, culture, beach, luxury),
preferred_airlines (string array),
preferred_food (cuisines/dietary — lasting),
travel_pace (relaxed | balanced | packed, or short phrase).

Current user travel memory JSON:
${JSON.stringify(input.current)}

Latest user message:
${input.userMessage.trim().slice(0, 2000)}

Return ONLY a JSON object with any of those keys.
If nothing durable to update, return {}.`;

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
              maxOutputTokens: 400,
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
      const patch = parseUserTravelMemoryPatch(raw);
      return mergeUserTravelMemoryFields(input.current, patch);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
    }
  }
  return input.current;
}

/**
 * Promote only clearly durable fields from conversation memory into user memory.
 * Never copies preferred_destination, travel_dates, candidates, discovery state, etc.
 */
export function promoteDurablePrefsFromConversation(input: {
  userMemory: UserTravelMemoryFields;
  conversationFoodPreferences?: string[];
  conversationBudget?: string | null;
  conversationTransport?: string | null;
}): UserTravelMemoryFields {
  const patch: Partial<UserTravelMemoryFields> = {};

  const foods = asStringArray(input.conversationFoodPreferences);
  if (foods.length > 0) patch.preferred_food = foods;

  // Budget only if it reads as a general range, not a trip total with dates.
  const budget = asNullableString(input.conversationBudget ?? null);
  if (budget && !/\b(this trip|for (the |this )?(week|month|dates?))\b/i.test(budget)) {
    patch.budget_range = budget;
  }

  // Airlines sometimes appear as transport preference.
  const transport = asNullableString(input.conversationTransport ?? null);
  if (
    transport &&
    /\b(air|airline|airways|fly|flight|indigo|emirates|qatar|singapore airlines|ana|jal|delta|united|lufthansa|british airways)\b/i.test(
      transport,
    )
  ) {
    patch.preferred_airlines = [transport];
  }

  if (Object.keys(patch).length === 0) return input.userMemory;
  return mergeUserTravelMemoryFields(input.userMemory, patch);
}

export async function loadUserTravelMemory(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserTravelMemory> {
  const { data, error } = await supabase
    .from("user_travel_memory")
    .select(MEMORY_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return emptyUserTravelMemory(userId);
  return normalizeUserTravelMemoryRow(data as MemoryRow | null, userId);
}

export async function ensureUserTravelMemory(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserTravelMemory> {
  const existing = await loadUserTravelMemory(supabase, userId);
  const { data: probe } = await supabase
    .from("user_travel_memory")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (probe?.user_id) return existing;

  await supabase.from("user_travel_memory").insert({
    user_id: userId,
    ...EMPTY_USER_TRAVEL_MEMORY_FIELDS,
    favorite_destinations: [],
    preferred_airlines: [],
    preferred_food: [],
  });

  return loadUserTravelMemory(supabase, userId);
}

export async function saveUserTravelMemory(
  supabase: SupabaseClient,
  userId: string,
  fields: UserTravelMemoryFields,
): Promise<UserTravelMemory> {
  const { data, error } = await supabase
    .from("user_travel_memory")
    .upsert(
      {
        user_id: userId,
        favorite_destinations: fields.favorite_destinations,
        hotel_type: fields.hotel_type,
        budget_range: fields.budget_range,
        travel_style: fields.travel_style,
        preferred_airlines: fields.preferred_airlines,
        preferred_food: fields.preferred_food,
        travel_pace: fields.travel_pace,
      },
      { onConflict: "user_id" },
    )
    .select(MEMORY_COLUMNS)
    .single();

  if (error || !data) {
    return {
      user_id: userId,
      ...fields,
      updated_at: new Date().toISOString(),
    };
  }
  return normalizeUserTravelMemoryRow(data as MemoryRow, userId);
}
