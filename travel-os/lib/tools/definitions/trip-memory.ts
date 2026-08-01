import {
  loadTripMemory,
  mergeTripMemoryFields,
  saveTripMemory,
  type TripMemory,
  type TripMemoryFields,
} from "@/lib/trip-memory";
import type { ToolDefinition, ToolResult } from "@/lib/tools/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GetTripMemoryInput = {
  tripId?: string;
};

export type UpdateTripMemoryInput = {
  tripId?: string;
  budget?: string | null;
  hotel_preference?: string | null;
  food_preference?: string | null;
  flight_preference?: string | null;
  interests?: string[];
  visited_places?: string[];
  packing_preferences?: string[];
  emergency_contacts?: Array<{
    name: string;
    phone?: string | null;
    relationship?: string | null;
    notes?: string | null;
  }>;
};

function resolveTripId(
  inputTripId: string | undefined,
  ctxTripId: string | undefined,
): string {
  return (inputTripId || ctxTripId || "").trim();
}

function getSupabase(ctx: { meta?: Record<string, unknown> }): SupabaseClient | null {
  const client = ctx.meta?.supabase;
  if (!client || typeof client !== "object") return null;
  return client as SupabaseClient;
}

export const getTripMemoryTool: ToolDefinition<GetTripMemoryInput, TripMemory> = {
  name: "get_trip_memory",
  description:
    "Load persistent trip memory (budget, hotel/food/flight preferences, interests, visited places, packing, emergency contacts).",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (optional if context already has tripId)",
        minLength: 1,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<TripMemory>> {
    const tripId = resolveTripId(input.tripId, ctx.tripId);
    if (!tripId) {
      return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
    }
    const supabase = getSupabase(ctx);
    if (!supabase) {
      return {
        ok: false,
        error: "Supabase client required in ctx.meta.supabase",
        code: "NOT_IMPLEMENTED",
      };
    }
    const memory = await loadTripMemory(supabase, tripId);
    return { ok: true, data: memory };
  },
};

export const updateTripMemoryTool: ToolDefinition<
  UpdateTripMemoryInput,
  TripMemory
> = {
  name: "update_trip_memory",
  description:
    "Merge updates into persistent trip memory. Array fields append new items; scalar fields overwrite when provided.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (optional if context already has tripId)",
        minLength: 1,
      },
      budget: { type: ["string", "null"], description: "Trip budget preference" },
      hotel_preference: {
        type: ["string", "null"],
        description: "Hotel / lodging preference",
      },
      food_preference: {
        type: ["string", "null"],
        description: "Food / dietary preference",
      },
      flight_preference: {
        type: ["string", "null"],
        description: "Flight preference",
      },
      interests: {
        type: "array",
        items: { type: "string" },
        description: "Interests to add",
      },
      visited_places: {
        type: "array",
        items: { type: "string" },
        description: "Places already visited",
      },
      packing_preferences: {
        type: "array",
        items: { type: "string" },
        description: "Packing preferences to add",
      },
      emergency_contacts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1 },
            phone: { type: ["string", "null"] },
            relationship: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
          },
        },
        description: "Emergency contacts to add or update",
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<TripMemory>> {
    const tripId = resolveTripId(input.tripId, ctx.tripId);
    if (!tripId) {
      return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
    }
    const supabase = getSupabase(ctx);
    if (!supabase) {
      return {
        ok: false,
        error: "Supabase client required in ctx.meta.supabase",
        code: "NOT_IMPLEMENTED",
      };
    }

    const patch: Partial<TripMemoryFields> = {};
    if ("budget" in input) patch.budget = input.budget ?? null;
    if ("hotel_preference" in input) patch.hotel_preference = input.hotel_preference ?? null;
    if ("food_preference" in input) patch.food_preference = input.food_preference ?? null;
    if ("flight_preference" in input) {
      patch.flight_preference = input.flight_preference ?? null;
    }
    if (input.interests !== undefined) patch.interests = input.interests;
    if (input.visited_places !== undefined) patch.visited_places = input.visited_places;
    if (input.packing_preferences !== undefined) {
      patch.packing_preferences = input.packing_preferences;
    }
    if (input.emergency_contacts !== undefined) {
      patch.emergency_contacts = input.emergency_contacts;
    }

    if (Object.keys(patch).length === 0) {
      return {
        ok: false,
        error: "Provide at least one memory field to update",
        code: "INVALID_INPUT",
      };
    }

    const current = await loadTripMemory(supabase, tripId);
    const merged = mergeTripMemoryFields(current, patch);
    const saved = await saveTripMemory(supabase, tripId, merged);
    return { ok: true, data: saved };
  },
};
