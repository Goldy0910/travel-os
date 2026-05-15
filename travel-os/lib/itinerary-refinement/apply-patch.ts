import type { SupabaseClient } from "@supabase/supabase-js";
import { createItineraryRevision } from "@/lib/ai/itinerary-revision-service";
import type { ApplyItineraryPatchResult, ItineraryItemPatchOp, ItineraryRefinementPatch } from "./types";
import { loadTripItineraryActivities, snapshotForDates } from "./snapshot";
import { sanitizePatchForUserEdits } from "./preview";

function isMissingSchemaObject(error: unknown): boolean {
  const message =
    error != null && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const code =
    error != null && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  return (
    code === "PGRST205" ||
    /column .* does not exist/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
}

async function ensureItineraryDayId(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  date: string,
): Promise<string | number> {
  const { data: existingDay } = await supabase
    .from("itinerary_days")
    .select("id")
    .eq("trip_id", tripId)
    .eq("date", date)
    .maybeSingle();

  if (existingDay?.id) return existingDay.id;

  const { data: newDay, error } = await supabase
    .from("itinerary_days")
    .insert({ trip_id: tripId, user_id: userId, date })
    .select("id")
    .single();

  if (error || !newDay?.id) {
    throw new Error(error?.message || "Could not create itinerary day");
  }
  return newDay.id;
}

function lockedIds(activities: { id: string; user_modified: boolean }[]): Set<string> {
  return new Set(activities.filter((a) => a.user_modified).map((a) => a.id));
}

export async function applyItineraryRefinementPatch(input: {
  supabase: SupabaseClient;
  tripId: string;
  userId: string;
  patch: ItineraryRefinementPatch;
}): Promise<ApplyItineraryPatchResult> {
  const activities = await loadTripItineraryActivities(input.supabase, input.tripId);
  const patch = sanitizePatchForUserEdits(input.patch, activities);
  const locked = lockedIds(activities);

  const beforeSnapshot = snapshotForDates(activities, patch.affectedDates);
  let appliedOps = 0;
  let skippedOps = 0;

  for (const op of patch.ops) {
    const applied = await applySingleOp({
      supabase: input.supabase,
      tripId: input.tripId,
      userId: input.userId,
      op,
      locked,
    });
    if (applied) appliedOps += 1;
    else skippedOps += 1;
  }

  const afterActivities = await loadTripItineraryActivities(input.supabase, input.tripId);
  const afterSnapshot = snapshotForDates(afterActivities, patch.affectedDates);

  const revisionId = await createItineraryRevision({
    supabase: input.supabase,
    tripId: input.tripId,
    revisionReason: patch.quickActionId
      ? `Itinerary refine: ${patch.quickActionId}`
      : "Itinerary refine",
    previous: {
      activities: beforeSnapshot.activities,
      affectedDates: beforeSnapshot.affectedDates,
    },
    updated: {
      activities: afterSnapshot.activities,
      affectedDates: afterSnapshot.affectedDates,
    },
  });

  return {
    patch,
    revisionId,
    appliedOps,
    skippedOps,
  };
}

async function applySingleOp(input: {
  supabase: SupabaseClient;
  tripId: string;
  userId: string;
  op: ItineraryItemPatchOp;
  locked: Set<string>;
}): Promise<boolean> {
  const { supabase, tripId, userId, op, locked } = input;

  if (op.op === "update") {
    if (locked.has(op.id)) return false;
    const title = op.title ?? op.activity_name;
    const payload: Record<string, unknown> = { ai_generated: true };
    if (title) {
      payload.activity_name = title;
      payload.title = title;
    }
    if (op.time !== undefined) payload.time = op.time;
    if (op.location) payload.location = op.location;
    if (op.notes !== undefined) payload.notes = op.notes;

    if (Object.keys(payload).length <= 1) return false;

    let { error } = await supabase
      .from("itinerary_items")
      .update(payload)
      .eq("trip_id", tripId)
      .eq("id", op.id)
      .eq("user_modified", false);

    if (error && isMissingSchemaObject(error)) {
      const lean: Record<string, unknown> = {};
      if (title) {
        lean.activity_name = title;
        lean.title = title;
      }
      if (op.time !== undefined) lean.time = op.time;
      if (op.location) lean.location = op.location;
      const res = await supabase
        .from("itinerary_items")
        .update(lean)
        .eq("trip_id", tripId)
        .eq("id", op.id)
        .eq("user_modified", false);
      error = res.error;
    }
    if (error) throw new Error(error.message || "Could not update activity.");
    return true;
  }

  if (op.op === "remove") {
    if (locked.has(op.id)) return false;
    const { error } = await supabase
      .from("itinerary_items")
      .delete()
      .eq("trip_id", tripId)
      .eq("id", op.id)
      .eq("user_modified", false);
    if (error) throw new Error(error.message || "Could not remove activity.");
    return true;
  }

  if (op.op === "add") {
    const dayId = await ensureItineraryDayId(supabase, tripId, userId, op.date);
    const name = op.activity_name ?? op.title;
    const row: Record<string, unknown> = {
      trip_id: tripId,
      user_id: userId,
      itinerary_day_id: dayId,
      date: op.date,
      activity_name: name,
      title: op.title,
      location: op.location || "Location TBD",
      time: op.time ?? "10:00",
      ai_generated: true,
      user_modified: false,
    };

    let { error } = await supabase.from("itinerary_items").insert(row);
    if (error && isMissingSchemaObject(error)) {
      const lean = {
        trip_id: tripId,
        user_id: userId,
        itinerary_day_id: dayId,
        date: op.date,
        activity_name: name,
        title: op.title,
        location: op.location || "Location TBD",
        time: op.time ?? "10:00",
      };
      const res = await supabase.from("itinerary_items").insert(lean);
      error = res.error;
    }
    if (error) throw new Error(error.message || "Could not add activity.");
    return true;
  }

  return false;
}
