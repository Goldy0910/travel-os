import type { ToolDefinition, ToolResult } from "@/lib/tools/types";

export type CreateTripInput = {
  location: string;
  startDate: string;
  endDate: string;
  title?: string;
  travelPlaceSlug?: string;
  budget?: string;
  travelers?: string;
  conversationId?: string;
};

export type CreateTripOutput = {
  status: "stub";
  message: string;
  draft: CreateTripInput;
  /** Where real create logic lives today (not invoked by this stub). */
  nextSteps: string[];
};

/**
 * Framework stub for create_trip.
 * Real persistence lives in create-trip actions / chat create-trip API —
 * wire those in once chat tool-calling is enabled.
 */
export const createTripTool: ToolDefinition<CreateTripInput, CreateTripOutput> = {
  name: "create_trip",
  description:
    "Create a new trip with destination and travel dates. Optionally link a chat conversation and capture budget/travelers.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["location", "startDate", "endDate"],
    properties: {
      location: {
        type: "string",
        description: "Destination or canonical location string",
        minLength: 1,
      },
      startDate: {
        type: "string",
        description: "Trip start date (YYYY-MM-DD)",
        minLength: 10,
        maxLength: 10,
      },
      endDate: {
        type: "string",
        description: "Trip end date (YYYY-MM-DD)",
        minLength: 10,
        maxLength: 10,
      },
      title: {
        type: "string",
        description: "Optional trip title (defaults to location)",
      },
      travelPlaceSlug: {
        type: "string",
        description: "Optional curated travel_places slug",
      },
      budget: {
        type: "string",
        description: "Optional budget note from chat discovery",
      },
      travelers: {
        type: "string",
        description: "Optional group size / travelers note",
      },
      conversationId: {
        type: "string",
        description: "Optional standalone conversation to attach after create",
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<CreateTripOutput>> {
    if (input.endDate < input.startDate) {
      return {
        ok: false,
        error: "endDate must be on or after startDate",
        code: "INVALID_INPUT",
      };
    }

    const draft: CreateTripInput = {
      ...input,
      title: input.title?.trim() || input.location,
      conversationId: input.conversationId ?? ctx.conversationId,
    };

    return {
      ok: true,
      data: {
        status: "stub",
        message:
          "create_trip validated input but did not persist. Connect to create-trip action or /api/chat/create-trip when enabling tool calls.",
        draft,
        nextSteps: [
          "app/app/create-trip/actions.ts (createTripAction)",
          "app/api/chat/create-trip/route.ts (chat-linked create)",
        ],
      },
    };
  },
};
