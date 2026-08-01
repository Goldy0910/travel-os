import { generateAndPersistItinerary } from "@/app/app/trip/[id]/_lib/generate-and-persist-itinerary";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import type { ToolDefinition, ToolResult } from "@/lib/tools/types";
import { revalidatePath } from "next/cache";

export type GenerateItineraryInput = {
  tripId: string;
  preferences?: string;
  pace?: "relaxed" | "balanced" | "packed";
  replaceExisting?: boolean;
};

export type GenerateItineraryOutput = {
  status: "generated" | "needs_confirmation";
  message: string;
  tripId: string;
  destination?: string;
  activityCount?: number;
  dayCount?: number;
  dates?: string[];
  replaced?: boolean;
  existingActivityCount?: number;
};

/**
 * Generate a day-by-day itinerary and write itinerary_days / itinerary_items.
 * Reuses the same persistence path as the itinerary AI setup sheet.
 */
export const generateItineraryTool: ToolDefinition<
  GenerateItineraryInput,
  GenerateItineraryOutput
> = {
  name: "generate_itinerary",
  description:
    "Generate or regenerate a day-by-day itinerary for an existing trip and save it to the trip itinerary database. Use this instead of writing a full itinerary as free text. Pass replaceExisting=true to overwrite an existing itinerary.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["tripId"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID to generate an itinerary for",
        minLength: 1,
      },
      preferences: {
        type: "string",
        description: "Free-text traveler preferences (food, pace, must-sees, budget)",
      },
      pace: {
        type: "string",
        description: "Desired itinerary density",
        enum: ["relaxed", "balanced", "packed"],
      },
      replaceExisting: {
        type: "boolean",
        description:
          "When true, replace existing itinerary days/items. Required if the trip already has activities.",
        default: false,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<GenerateItineraryOutput>> {
    const tripId = (input.tripId || ctx.tripId || "").trim();
    if (!tripId) {
      return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
    }

    const userId = ctx.userId?.trim();
    if (!userId) {
      return { ok: false, error: "Authentication required", code: "UNAUTHORIZED" };
    }

    const supabase = await createSupabaseServerClient();
    const member = await isTripMember(supabase, tripId, userId);
    if (!member) {
      return { ok: false, error: "Not a trip member", code: "UNAUTHORIZED" };
    }

    const result = await generateAndPersistItinerary({
      supabase,
      tripId,
      userId,
      preferences: input.preferences,
      pace: input.pace,
      replaceExisting: input.replaceExisting === true,
    });

    if (!result.ok) {
      if (result.code === "NEEDS_CONFIRMATION") {
        return {
          ok: true,
          data: {
            status: "needs_confirmation",
            message: result.error,
            tripId,
            existingActivityCount: result.existingActivityCount,
          },
        };
      }
      return {
        ok: false,
        error: result.error,
        code: result.code ?? "HANDLER_ERROR",
      };
    }

    revalidatePath(`/app/trip/${tripId}`);
    revalidatePath("/app/home");

    return {
      ok: true,
      data: {
        status: "generated",
        message: result.replaced
          ? `Replaced the itinerary for ${result.destination} with ${result.activityCount} activities across ${result.dayCount} days.`
          : `Created an itinerary for ${result.destination} with ${result.activityCount} activities across ${result.dayCount} days.`,
        tripId,
        destination: result.destination,
        activityCount: result.activityCount,
        dayCount: result.dayCount,
        dates: result.dates,
        replaced: result.replaced,
      },
    };
  },
};
