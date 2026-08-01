import { applyItineraryProposedEdits } from "@/lib/ai/apply-itinerary-revisions";
import { createItineraryRevision } from "@/lib/ai/itinerary-revision-service";
import type { ItineraryOptimizationActivity } from "@/lib/ai/itinerary-optimization-engine";
import {
  isItineraryEditIntent,
  isItineraryEditOp,
  type ItineraryEditIntent,
  type ItineraryProposedEdit,
} from "@/lib/chat/itinerary-edit-types";
import {
  isToolFailure,
  loadTripItinerarySnapshot,
  requireItineraryToolAuth,
} from "@/lib/tools/itinerary/auth";
import type { ToolDefinition, ToolResult } from "@/lib/tools/types";
import { extractYMD } from "@/lib/itinerary-trip-range";
import { revalidatePath } from "next/cache";

export type ApplyItineraryEditsInput = {
  tripId?: string;
  proposalId?: string;
  intent?: ItineraryEditIntent;
  summary?: string;
  edits: Array<{
    op: string;
    day: string;
    activityId?: string;
    title?: string;
    location?: string | null;
    time?: string | null;
    toDay?: string;
    notes?: string | null;
  }>;
};

export type ApplyItineraryEditsOutput = {
  status: "applied";
  proposalId: string | null;
  revisionId: string | null;
  changes: {
    added: number;
    updated: number;
    deleted: number;
    moved: number;
  };
  appliedDays: string[];
  message: string;
};

function parseYmd(input: string): string {
  const v = input.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  if (m) return m[1]!;
  return extractYMD(v) ?? "";
}

function coerceEdits(
  raw: ApplyItineraryEditsInput["edits"],
): ItineraryProposedEdit[] {
  const edits: ItineraryProposedEdit[] = [];
  for (const row of raw ?? []) {
    if (!row || !isItineraryEditOp(row.op)) continue;
    const day = parseYmd(row.day);
    if (!day) continue;
    edits.push({
      op: row.op,
      day,
      activityId:
        typeof row.activityId === "string" && row.activityId.trim()
          ? row.activityId.trim()
          : undefined,
      title:
        typeof row.title === "string" && row.title.trim()
          ? row.title.trim()
          : undefined,
      location:
        typeof row.location === "string" && row.location.trim()
          ? row.location.trim()
          : null,
      time:
        typeof row.time === "string" && row.time.trim()
          ? row.time.trim()
          : null,
      toDay:
        typeof row.toDay === "string" && row.toDay.trim()
          ? parseYmd(row.toDay) || undefined
          : undefined,
      notes:
        typeof row.notes === "string" && row.notes.trim()
          ? row.notes.trim()
          : null,
    });
  }
  return edits;
}

function toSnapshotActivity(
  tripId: string,
  row: {
    id: string;
    title: string;
    location: string | null;
    time: string | null;
    date: string;
  },
): ItineraryOptimizationActivity {
  return {
    id: row.id,
    trip_id: tripId,
    itinerary_day_id: null,
    date: row.date,
    title: row.title,
    location: row.location || "",
    time: row.time,
    priority_score: null,
    sunset_sensitive: false,
    booking_required: false,
    ai_generated: false,
    user_modified: true,
  };
}

/**
 * Apply a confirmed itinerary edit proposal to itinerary_items.
 * Call only after the user confirms in the UI — never auto-apply from the LLM.
 */
export const applyItineraryEditsTool: ToolDefinition<
  ApplyItineraryEditsInput,
  ApplyItineraryEditsOutput
> = {
  name: "apply_itinerary_edits",
  description:
    "Apply previously proposed itinerary edits AFTER the user confirms. Writes to itinerary_items. Do not call this until the user explicitly confirms the proposal in the UI.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["edits"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId)",
        minLength: 1,
      },
      proposalId: {
        type: "string",
        description: "Id of the pending proposal being confirmed",
      },
      intent: {
        type: "string",
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
        description: "Optional summary stored on the revision",
      },
      edits: {
        type: "array",
        description: "Confirmed edits (same shape as propose_itinerary_edits)",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["op", "day"],
          properties: {
            op: {
              type: "string",
              enum: ["add", "update", "delete", "move"],
            },
            day: { type: "string", minLength: 10, maxLength: 10 },
            activityId: { type: "string" },
            title: { type: "string" },
            location: { type: "string" },
            time: { type: "string" },
            toDay: { type: "string", minLength: 10, maxLength: 10 },
            notes: { type: "string" },
          },
        },
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<ApplyItineraryEditsOutput>> {
    const edits = coerceEdits(input.edits);
    if (edits.length === 0) {
      return {
        ok: false,
        error: "At least one valid edit is required",
        code: "INVALID_INPUT",
      };
    }

    const auth = await requireItineraryToolAuth(input.tripId, ctx);
    if (isToolFailure(auth)) return auth;

    const { supabase, user, tripId } = auth;
    const snapshot = await loadTripItinerarySnapshot(supabase, tripId);
    const previous = snapshot.activities.map((a) =>
      toSnapshotActivity(tripId, a),
    );

    const applied = await applyItineraryProposedEdits({
      supabase,
      tripId,
      userId: user.id,
      tripStartDate: snapshot.tripStartDate,
      tripEndDate: snapshot.tripEndDate,
      existingActivities: new Map(snapshot.activityMap),
      edits,
    });

    const total =
      applied.added + applied.updated + applied.deleted + applied.moved;
    if (total === 0) {
      return {
        ok: false,
        error: "No itinerary changes were applied",
        code: "HANDLER_ERROR",
      };
    }

    const after = await loadTripItinerarySnapshot(supabase, tripId);
    const updated = after.activities
      .filter((a) => applied.appliedDays.includes(a.date))
      .map((a) => toSnapshotActivity(tripId, a));

    const intent =
      input.intent && isItineraryEditIntent(input.intent)
        ? input.intent
        : "optimize_route";
    const reasonBits = [
      "apply_itinerary_edits",
      intent,
      input.proposalId ? `proposal:${input.proposalId}` : null,
      typeof input.summary === "string" ? input.summary.slice(0, 120) : null,
    ].filter(Boolean);

    const revisionId = await createItineraryRevision({
      supabase,
      tripId,
      revisionReason: reasonBits.join(":"),
      previous: { activities: previous },
      updated: { activities: updated },
    });

    revalidatePath(`/app/trip/${tripId}`);
    revalidatePath(`/app/trip/${tripId}`, "page");

    const parts: string[] = [];
    if (applied.added) parts.push(`added ${applied.added}`);
    if (applied.updated) parts.push(`updated ${applied.updated}`);
    if (applied.moved) parts.push(`moved ${applied.moved}`);
    if (applied.deleted) parts.push(`removed ${applied.deleted}`);

    return {
      ok: true,
      data: {
        status: "applied",
        proposalId: input.proposalId?.trim() || null,
        revisionId,
        changes: {
          added: applied.added,
          updated: applied.updated,
          deleted: applied.deleted,
          moved: applied.moved,
        },
        appliedDays: applied.appliedDays,
        message: `Itinerary updated (${parts.join(", ")}).`,
      },
    };
  },
};
