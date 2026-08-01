import type { ToolDefinition, ToolResult } from "@/lib/tools/types";

export type UpdateTripInput = {
  tripId: string;
  title?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
};

export type UpdateTripOutput = {
  status: "stub";
  message: string;
  patch: UpdateTripInput;
  nextSteps: string[];
};

/**
 * Framework stub for update_trip.
 * Real updates use updateTripDetailsAction (organizer-only).
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
    const tripId = input.tripId || ctx.tripId;
    if (!tripId) {
      return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
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

    if (input.startDate && input.endDate && input.endDate < input.startDate) {
      return {
        ok: false,
        error: "endDate must be on or after startDate",
        code: "INVALID_INPUT",
      };
    }

    const patch: UpdateTripInput = { ...input, tripId };

    return {
      ok: true,
      data: {
        status: "stub",
        message:
          "update_trip validated input but did not persist. Connect to updateTripDetailsAction when enabling tool calls.",
        patch,
        nextSteps: ["app/app/trip/[id]/data-actions.ts (updateTripDetailsAction)"],
      },
    };
  },
};
