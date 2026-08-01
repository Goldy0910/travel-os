import {
  isItineraryEditIntent,
  isItineraryEditOp,
  type ItineraryEditIntent,
  type ItineraryEditProposal,
  type ItineraryProposedEdit,
} from "@/lib/chat/itinerary-edit-types";
import {
  isToolFailure,
  loadTripItinerarySnapshot,
  requireItineraryToolAuth,
} from "@/lib/tools/itinerary/auth";
import type { ToolDefinition, ToolResult } from "@/lib/tools/types";
import { extractYMD } from "@/lib/itinerary-trip-range";

export type ProposeItineraryEditsInput = {
  tripId?: string;
  intent: ItineraryEditIntent;
  summary: string;
  rationale?: string;
  edits: Array<{
    op: string;
    day: string;
    activityId?: string;
    title?: string;
    location?: string;
    time?: string;
    toDay?: string;
    notes?: string;
  }>;
};

export type ProposeItineraryEditsOutput = {
  status: "proposed";
  proposal: ItineraryEditProposal;
  /** True when this is a proposal only — DB was not mutated. */
  requiresConfirmation: true;
};

function parseYmd(input: string): string {
  const v = input.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  if (m) return m[1]!;
  return extractYMD(v) ?? "";
}

function normalizeEdit(
  raw: ProposeItineraryEditsInput["edits"][number],
  activityTitles: Map<string, string>,
): ItineraryProposedEdit | null {
  if (!isItineraryEditOp(raw.op)) return null;
  const day = parseYmd(raw.day);
  if (!day) return null;

  const activityId =
    typeof raw.activityId === "string" && raw.activityId.trim()
      ? raw.activityId.trim()
      : undefined;
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : activityId
        ? activityTitles.get(activityId)
        : undefined;
  const toDay =
    typeof raw.toDay === "string" && raw.toDay.trim()
      ? parseYmd(raw.toDay) || undefined
      : undefined;
  const location =
    typeof raw.location === "string" && raw.location.trim()
      ? raw.location.trim()
      : undefined;
  const time =
    typeof raw.time === "string" && raw.time.trim() ? raw.time.trim() : undefined;
  const notes =
    typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : undefined;

  if ((raw.op === "update" || raw.op === "delete" || raw.op === "move") && !activityId) {
    return null;
  }
  if (raw.op === "add" && !title) return null;
  if (raw.op === "move" && !toDay) return null;

  let label = "";
  if (raw.op === "add") label = `Add “${title}” on ${day}`;
  else if (raw.op === "delete") label = `Remove “${title ?? "activity"}”`;
  else if (raw.op === "move")
    label = `Move “${title ?? "activity"}” → ${toDay}${time ? ` at ${time}` : ""}`;
  else label = `Update “${title ?? "activity"}”${time ? ` → ${time}` : ""}`;

  return {
    op: raw.op,
    day,
    activityId,
    title,
    location: location ?? null,
    time: time ?? null,
    toDay,
    notes: notes ?? null,
    label,
  };
}

/**
 * Build a structured itinerary edit proposal without writing to the database.
 * The UI must show confirmation; apply_itinerary_edits performs the write.
 */
export const proposeItineraryEditsTool: ToolDefinition<
  ProposeItineraryEditsInput,
  ProposeItineraryEditsOutput
> = {
  name: "propose_itinerary_edits",
  description:
    "Propose itinerary changes (move, delete, add, optimize route, reduce cost, or increase relaxation) WITHOUT applying them. Returns a proposal the user must confirm before apply_itinerary_edits writes to the database. Always use exact activityIds from the trip itinerary when updating, deleting, or moving.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["intent", "summary", "edits"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId)",
        minLength: 1,
      },
      intent: {
        type: "string",
        description: "High-level edit intent",
        enum: [
          "move_activity",
          "delete_activity",
          "add_activity",
          "optimize_route",
          "reduce_cost",
          "increase_relaxation",
        ],
      },
      summary: {
        type: "string",
        description: "1–2 sentence human summary of the proposed changes",
        minLength: 1,
      },
      rationale: {
        type: "string",
        description: "Optional brief why these edits help",
      },
      edits: {
        type: "array",
        description: "Structured edits to propose (not yet applied)",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["op", "day"],
          properties: {
            op: {
              type: "string",
              enum: ["add", "update", "delete", "move"],
            },
            day: {
              type: "string",
              description: "YYYY-MM-DD source/target day",
              minLength: 10,
              maxLength: 10,
            },
            activityId: {
              type: "string",
              description: "Existing activity UUID (required for update/delete/move)",
            },
            title: { type: "string" },
            location: { type: "string" },
            time: {
              type: "string",
              description: "HH:mm 24-hour time",
            },
            toDay: {
              type: "string",
              description: "YYYY-MM-DD target day for move",
              minLength: 10,
              maxLength: 10,
            },
            notes: { type: "string" },
          },
        },
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<ProposeItineraryEditsOutput>> {
    if (!isItineraryEditIntent(input.intent)) {
      return { ok: false, error: "Invalid intent", code: "INVALID_INPUT" };
    }
    const summary = typeof input.summary === "string" ? input.summary.trim() : "";
    if (!summary) {
      return { ok: false, error: "summary is required", code: "INVALID_INPUT" };
    }
    if (!Array.isArray(input.edits) || input.edits.length === 0) {
      return {
        ok: false,
        error: "At least one edit is required",
        code: "INVALID_INPUT",
      };
    }

    const auth = await requireItineraryToolAuth(input.tripId, ctx);
    if (isToolFailure(auth)) return auth;

    const { supabase, tripId } = auth;
    const snapshot = await loadTripItinerarySnapshot(supabase, tripId);
    const titleById = new Map(
      snapshot.activities.map((a) => [a.id, a.title] as const),
    );

    const edits: ItineraryProposedEdit[] = [];
    for (const raw of input.edits) {
      const normalized = normalizeEdit(raw, titleById);
      if (!normalized) continue;

      if (
        (normalized.op === "update" ||
          normalized.op === "delete" ||
          normalized.op === "move") &&
        normalized.activityId &&
        !snapshot.activityMap.has(normalized.activityId)
      ) {
        continue;
      }

      if (snapshot.tripStartDate || snapshot.tripEndDate) {
        const dayOk =
          (!snapshot.tripStartDate || normalized.day >= snapshot.tripStartDate) &&
          (!snapshot.tripEndDate || normalized.day <= snapshot.tripEndDate);
        if (!dayOk) continue;
        if (normalized.toDay) {
          const toOk =
            (!snapshot.tripStartDate || normalized.toDay >= snapshot.tripStartDate) &&
            (!snapshot.tripEndDate || normalized.toDay <= snapshot.tripEndDate);
          if (!toOk) continue;
        }
      }

      edits.push(normalized);
    }

    if (edits.length === 0) {
      return {
        ok: false,
        error:
          "No valid edits after validation. Use exact activityIds from the itinerary and days within the trip range.",
        code: "INVALID_INPUT",
      };
    }

    const proposal: ItineraryEditProposal = {
      proposalId: crypto.randomUUID(),
      tripId,
      intent: input.intent,
      summary,
      rationale:
        typeof input.rationale === "string" && input.rationale.trim()
          ? input.rationale.trim()
          : undefined,
      edits,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    return {
      ok: true,
      data: {
        status: "proposed",
        proposal,
        requiresConfirmation: true,
      },
    };
  },
};
