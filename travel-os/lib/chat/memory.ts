import { GEMINI_GENERATE_MODELS } from "@/lib/ai/gemini-models";
import {
  EMPTY_MEMORY_FIELDS,
  emptyConversationMemory,
  type ConversationMemory,
  type ConversationMemoryFields,
  type DiscoveryPhase,
} from "@/lib/chat/memory-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  formatMemoryForPrompt,
  memoryHasValues,
} from "@/lib/chat/memory-types";


const MEMORY_COLUMNS =
  "conversation_id, preferred_destination, budget, travel_dates, group_size, interests, food_preferences, transport_preference, weather_preference, visa_preference, travel_duration, discovery_active, discovery_phase, candidate_destinations, updated_at";

type MemoryRow = {
  conversation_id: string;
  preferred_destination: string | null;
  budget: string | null;
  travel_dates: string | null;
  group_size: string | null;
  interests: unknown;
  food_preferences: unknown;
  transport_preference: string | null;
  weather_preference?: string | null;
  visa_preference?: string | null;
  travel_duration?: string | null;
  discovery_active?: boolean | null;
  discovery_phase?: string | null;
  candidate_destinations?: unknown;
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

function asDiscoveryPhase(value: unknown): DiscoveryPhase {
  const allowed: DiscoveryPhase[] = [
    "idle",
    "gathering",
    "narrowing",
    "shortlist",
    "complete",
  ];
  if (typeof value === "string" && (allowed as string[]).includes(value)) {
    return value as DiscoveryPhase;
  }
  return "idle";
}

export function normalizeMemoryRow(
  row: MemoryRow | null | undefined,
  conversationId: string,
): ConversationMemory {
  if (!row) return emptyConversationMemory(conversationId);
  return {
    conversation_id: row.conversation_id || conversationId,
    preferred_destination: asNullableString(row.preferred_destination),
    budget: asNullableString(row.budget),
    travel_dates: asNullableString(row.travel_dates),
    group_size: asNullableString(row.group_size),
    interests: asStringArray(row.interests),
    food_preferences: asStringArray(row.food_preferences),
    transport_preference: asNullableString(row.transport_preference),
    weather_preference: asNullableString(row.weather_preference ?? null),
    visa_preference: asNullableString(row.visa_preference ?? null),
    travel_duration: asNullableString(row.travel_duration ?? null),
    discovery_active: Boolean(row.discovery_active),
    discovery_phase: asDiscoveryPhase(row.discovery_phase),
    candidate_destinations: asStringArray(row.candidate_destinations),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

function mergeStringArrays(existing: string[], incoming: string[]): string[] {
  return asStringArray([...existing, ...incoming]);
}

export function mergeMemoryFields(
  current: ConversationMemoryFields,
  patch: Partial<ConversationMemoryFields>,
): ConversationMemoryFields {
  return {
    preferred_destination:
      patch.preferred_destination !== undefined && patch.preferred_destination !== null
        ? asNullableString(patch.preferred_destination)
        : current.preferred_destination,
    budget:
      patch.budget !== undefined && patch.budget !== null
        ? asNullableString(patch.budget)
        : current.budget,
    travel_dates:
      patch.travel_dates !== undefined && patch.travel_dates !== null
        ? asNullableString(patch.travel_dates)
        : current.travel_dates,
    group_size:
      patch.group_size !== undefined && patch.group_size !== null
        ? asNullableString(patch.group_size)
        : current.group_size,
    interests:
      patch.interests !== undefined
        ? mergeStringArrays(current.interests, asStringArray(patch.interests))
        : current.interests,
    food_preferences:
      patch.food_preferences !== undefined
        ? mergeStringArrays(current.food_preferences, asStringArray(patch.food_preferences))
        : current.food_preferences,
    transport_preference:
      patch.transport_preference !== undefined && patch.transport_preference !== null
        ? asNullableString(patch.transport_preference)
        : current.transport_preference,
    weather_preference:
      patch.weather_preference !== undefined && patch.weather_preference !== null
        ? asNullableString(patch.weather_preference)
        : current.weather_preference,
    visa_preference:
      patch.visa_preference !== undefined && patch.visa_preference !== null
        ? asNullableString(patch.visa_preference)
        : current.visa_preference,
    travel_duration:
      patch.travel_duration !== undefined && patch.travel_duration !== null
        ? asNullableString(patch.travel_duration)
        : current.travel_duration,
    discovery_active:
      patch.discovery_active !== undefined
        ? Boolean(patch.discovery_active)
        : current.discovery_active,
    discovery_phase:
      patch.discovery_phase !== undefined
        ? asDiscoveryPhase(patch.discovery_phase)
        : current.discovery_phase,
    candidate_destinations:
      patch.candidate_destinations !== undefined
        ? mergeStringArrays(
            current.candidate_destinations,
            asStringArray(patch.candidate_destinations),
          )
        : current.candidate_destinations,
  };
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseMemoryPatch(raw: string): Partial<ConversationMemoryFields> {
  try {
    const parsed = JSON.parse(stripJsonFences(raw)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const patch: Partial<ConversationMemoryFields> = {};
    if ("preferred_destination" in parsed) {
      patch.preferred_destination = asNullableString(parsed.preferred_destination);
    }
    if ("budget" in parsed) patch.budget = asNullableString(parsed.budget);
    if ("travel_dates" in parsed) {
      patch.travel_dates = asNullableString(parsed.travel_dates);
    }
    if ("group_size" in parsed) patch.group_size = asNullableString(parsed.group_size);
    if ("interests" in parsed) patch.interests = asStringArray(parsed.interests);
    if ("food_preferences" in parsed) {
      patch.food_preferences = asStringArray(parsed.food_preferences);
    }
    if ("transport_preference" in parsed) {
      patch.transport_preference = asNullableString(parsed.transport_preference);
    }
    if ("weather_preference" in parsed) {
      patch.weather_preference = asNullableString(parsed.weather_preference);
    }
    if ("visa_preference" in parsed) {
      patch.visa_preference = asNullableString(parsed.visa_preference);
    }
    if ("travel_duration" in parsed) {
      patch.travel_duration = asNullableString(parsed.travel_duration);
    }
    if ("candidate_destinations" in parsed) {
      patch.candidate_destinations = asStringArray(parsed.candidate_destinations);
    }
    return patch;
  } catch {
    return {};
  }
}

/**
 * Extract travel preference updates from a user message and merge into current memory.
 */
export async function updateMemoryFromUserMessage(input: {
  current: ConversationMemoryFields;
  userMessage: string;
  signal?: AbortSignal;
}): Promise<ConversationMemoryFields> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return input.current;

  const prompt = `You maintain conversation-scoped travel memory for a Discovery / chat assistant.
Update ONLY fields clearly stated or strongly implied in the latest user message.
Do not invent values. Do not create trips or itineraries.
If a field is unchanged, omit it from the JSON.

Current memory JSON:
${JSON.stringify(input.current)}

Latest user message:
${input.userMessage.trim().slice(0, 2000)}

Return ONLY a JSON object with any of these keys:
preferred_destination (string — only if user clearly chose one place),
budget (string),
travel_dates (string),
travel_duration (string),
group_size (string),
weather_preference (string),
visa_preference (string),
interests (string array — new items only),
food_preferences (string array — new items only),
transport_preference (string),
candidate_destinations (string array — places user wants to keep/shortlist).

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
              maxOutputTokens: 500,
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
      const patch = parseMemoryPatch(raw);
      return mergeMemoryFields(input.current, patch);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
    }
  }
  return input.current;
}

/** Pull destination names from a Discovery Agent shortlist reply. */
export function harvestCandidateDestinations(assistantText: string): string[] {
  const found: string[] = [];
  const lines = assistantText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // 1. **Bali** — ...  OR  - **Japan**: ...
    const bold = /^\d+[\).:-]\s*\*\*([^*]+)\*\*/.exec(trimmed)
      || /^[-*]\s*\*\*([^*]+)\*\*/.exec(trimmed)
      || /^\d+[\).:-]\s*([A-Z][A-Za-zÀ-ÿ .'-]{1,40})(?:\s*[—:\-]|\s*$)/.exec(trimmed);
    if (!bold?.[1]) continue;
    const name = bold[1].replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 60) continue;
    if (!found.some((x) => x.toLowerCase() === name.toLowerCase())) {
      found.push(name);
    }
  }
  return found.slice(0, 8);
}

export async function loadConversationMemory(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ConversationMemory> {
  const { data, error } = await supabase
    .from("conversation_memory")
    .select(MEMORY_COLUMNS)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (error) return emptyConversationMemory(conversationId);
  return normalizeMemoryRow((data as MemoryRow | null) ?? null, conversationId);
}

export async function ensureConversationMemory(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ConversationMemory> {
  const existing = await loadConversationMemory(supabase, conversationId);
  const { data: probe } = await supabase
    .from("conversation_memory")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (probe?.conversation_id) return existing;

  await supabase.from("conversation_memory").insert({
    conversation_id: conversationId,
    ...EMPTY_MEMORY_FIELDS,
    interests: [],
    food_preferences: [],
    candidate_destinations: [],
  });

  return loadConversationMemory(supabase, conversationId);
}

export async function saveConversationMemory(
  supabase: SupabaseClient,
  conversationId: string,
  fields: ConversationMemoryFields,
): Promise<ConversationMemory> {
  const { data, error } = await supabase
    .from("conversation_memory")
    .upsert(
      {
        conversation_id: conversationId,
        preferred_destination: fields.preferred_destination,
        budget: fields.budget,
        travel_dates: fields.travel_dates,
        group_size: fields.group_size,
        interests: fields.interests,
        food_preferences: fields.food_preferences,
        transport_preference: fields.transport_preference,
        weather_preference: fields.weather_preference,
        visa_preference: fields.visa_preference,
        travel_duration: fields.travel_duration,
        discovery_active: fields.discovery_active,
        discovery_phase: fields.discovery_phase,
        candidate_destinations: fields.candidate_destinations,
      },
      { onConflict: "conversation_id" },
    )
    .select(MEMORY_COLUMNS)
    .single();

  if (error || !data) {
    return {
      conversation_id: conversationId,
      ...fields,
      updated_at: new Date().toISOString(),
    };
  }
  return normalizeMemoryRow(data as MemoryRow, conversationId);
}
