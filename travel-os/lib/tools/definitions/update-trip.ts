import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMemberRole } from "@/lib/trip-membership";
import type { ToolDefinition, ToolResult } from "@/lib/tools/types";
import { revalidatePath } from "next/cache";

export type UpdateTripInput = {
  tripId: string;
  title?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
};

export type UpdateTripOutput = {
  status: "updated";
  message: string;
  patch: UpdateTripInput;
};

/**
 * Persist trip details for an organizer. The trip chat uses this to extend a
 * trip before it proposes activities for a newly added day.
 */
export const updateTripTool: ToolDefinition<UpdateTripInput, UpdateTripOutput> = {
  name: "update_trip",
  description:
    "Update an existing trip's title, location, or date range. At least one mutable field must be provided.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["tripId"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID to update",
        minLength: 1,
      },
      title: {
        type: "string",
        description: "New trip title",
        minLength: 1,
      },
      location: {
        type: "string",
        description: "New destination / location",
        minLength: 1,
      },
      startDate: {
        type: "string",
        description: "New start date (YYYY-MM-DD)",
        minLength: 10,
        maxLength: 10,
      },
      endDate: {
        type: "string",
        description: "New end date (YYYY-MM-DD)",
        minLength: 10,
        maxLength: 10,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<UpdateTripOutput>> {
    const tripId = (input.tripId || ctx.tripId || "").trim();
    if (!tripId) {
      return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
    }
    if (!ctx.userId) {
      return { ok: false, error: "Authentication required", code: "UNAUTHORIZED" };
    }

    const hasPatch =
      input.title != null ||
      input.location != null ||
      input.startDate != null ||
      input.endDate != null;

    if (!hasPatch) {
      return {
        ok: false,
        error: "Provide at least one of title, location, startDate, endDate",
        code: "INVALID_INPUT",
      };
    }

    const supabase = await createSupabaseServerClient();
    const role = await getMemberRole(supabase, tripId, ctx.userId);
    if (role !== "organizer") {
      return {
        ok: false,
        error: "Only the trip organizer can change trip dates or details.",
        code: "UNAUTHORIZED",
      };
    }

    const { data: current, error: currentError } = await supabase
      .from("trips")
      .select("start_date, end_date")
      .eq("id", tripId)
      .maybeSingle();
    if (currentError || !current) {
      return {
        ok: false,
        error: currentError?.message || "Trip not found",
        code: "HANDLER_ERROR",
      };
    }

    const startDate = input.startDate?.trim() || String(current.start_date ?? "").slice(0, 10);
    const endDate = input.endDate?.trim() || String(current.end_date ?? "").slice(0, 10);
    if (startDate && endDate && endDate < startDate) {
      return {
        ok: false,
        error: "endDate must be on or after startDate",
        code: "INVALID_INPUT",
      };
    }

    const patch: UpdateTripInput = { ...input, tripId };
    const updates: Record<string, string> = {};
    if (input.title?.trim()) updates.title = input.title.trim();
    if (input.location?.trim()) updates.location = input.location.trim();
    if (input.startDate?.trim()) updates.start_date = input.startDate.trim();
    if (input.endDate?.trim()) updates.end_date = input.endDate.trim();

    const { error: updateError } = await supabase.from("trips").update(updates).eq("id", tripId);
    if (updateError) {
      return { ok: false, error: updateError.message, code: "HANDLER_ERROR" };
    }

    revalidatePath(`/app/trip/${tripId}`);
    revalidatePath("/app/home");

    return {
      ok: true,
      data: {
        status: "updated",
        message: "Trip details updated.",
        patch,
      },
    };
  },
};
