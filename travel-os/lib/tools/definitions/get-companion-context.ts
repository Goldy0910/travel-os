import {
  loadTripCompanionContext,
  type TripCompanionContext,
} from "@/lib/chat/trip-companion";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ToolDefinition, ToolResult } from "@/lib/tools/types";

export type GetCompanionContextInput = {
  tripId?: string;
  /** Optional YYYY-MM-DD override for "today". */
  date?: string;
};

export type GetCompanionContextOutput = {
  context: TripCompanionContext;
};

/**
 * On-demand refresh of the live trip companion snapshot.
 * Used when the model needs an updated day / itinerary / weather view.
 */
export const getCompanionContextTool: ToolDefinition<
  GetCompanionContextInput,
  GetCompanionContextOutput
> = {
  name: "get_companion_context",
  description:
    "Load or refresh the live trip companion context: current day, destination, today's itinerary, local time, weather summary, and nearby activity ideas.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId when omitted)",
        minLength: 1,
      },
      date: {
        type: "string",
        description: "Optional calendar date override (YYYY-MM-DD)",
        minLength: 10,
        maxLength: 10,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<GetCompanionContextOutput>> {
    const tripId =
      (typeof input.tripId === "string" && input.tripId.trim()) ||
      (typeof ctx.tripId === "string" && ctx.tripId.trim()) ||
      "";

    if (!tripId) {
      return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
    }

    try {
      const fromMeta = ctx.meta?.supabase;
      const supabase =
        fromMeta && typeof fromMeta === "object"
          ? (fromMeta as Awaited<ReturnType<typeof createSupabaseServerClient>>)
          : await createSupabaseServerClient();

      const context = await loadTripCompanionContext(supabase, tripId, {
        date: typeof input.date === "string" ? input.date : null,
      });

      if (!context) {
        return {
          ok: false,
          error: "Trip not found or companion context unavailable",
          code: "HANDLER_ERROR",
        };
      }

      return { ok: true, data: { context } };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load companion context";
      return { ok: false, error: message, code: "HANDLER_ERROR" };
    }
  },
};
