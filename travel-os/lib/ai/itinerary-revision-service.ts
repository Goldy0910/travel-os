import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItineraryOptimizationActivity } from "@/lib/ai/itinerary-optimization-engine";

type SnapshotPayload = {
  activities: ItineraryOptimizationActivity[];
  affectedDates?: string[];
};

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

function normalizeDate(date: string): string {
  const v = date.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  if (m) return m[1]!;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export async function createItineraryRevision(input: {
  supabase: SupabaseClient;
  tripId: string;
  dayId?: string | null;
  revisionReason: string;
  previous: SnapshotPayload;
  updated: SnapshotPayload;
}): Promise<string | null> {
  const { data, error } = await input.supabase
    .from("itinerary_revisions")
    .insert({
      trip_id: input.tripId,
      day_id: input.dayId ?? null,
      revision_reason: input.revisionReason,
      previous_snapshot: input.previous,
      updated_snapshot: input.updated,
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    if (isMissingSchemaObject(error)) return null;
    return null;
  }
  return String(data.id);
}

export async function applyOptimizedActivities(input: {
  supabase: SupabaseClient;
  tripId: string;
  userId: string;
  date: string;
  optimized: ItineraryOptimizationActivity[];
}): Promise<void> {
  const dateYmd = normalizeDate(input.date);
  if (!dateYmd) throw new Error("Invalid date");

  const { data: existingRows, error: existingError } = await input.supabase
    .from("itinerary_items")
    .select("id")
    .eq("trip_id", input.tripId)
    .eq("date", dateYmd);
  if (existingError) throw new Error(existingError.message || "Could not load existing itinerary.");

  const existingIds = new Set((existingRows ?? []).map((row) => String(row.id)));
  const incomingIds = new Set(
    input.optimized
      .map((activity) => (activity.id ? String(activity.id) : ""))
      .filter((id) => id.length > 0),
  );

  const idsToDelete = Array.from(existingIds).filter((id) => !incomingIds.has(id));
  if (idsToDelete.length > 0) {
    const { error: deleteError } = await input.supabase
      .from("itinerary_items")
      .delete()
      .eq("trip_id", input.tripId)
      .in("id", idsToDelete);
    if (deleteError) throw new Error(deleteError.message || "Could not remove dropped activities.");
  }

  const toInsert: Array<Record<string, unknown>> = [];
  const toUpdate = input.optimized.filter((activity) => existingIds.has(String(activity.id)));

  for (const activity of toUpdate) {
    const richUpdate = {
      itinerary_day_id: activity.itinerary_day_id,
      date: dateYmd,
      activity_name: activity.title,
      title: activity.title,
      location: activity.location || "Location TBD",
      time: activity.time,
      priority_score: activity.priority_score,
      sunset_sensitive: activity.sunset_sensitive,
      booking_required: activity.booking_required,
      ai_generated: true,
      user_modified: activity.user_modified,
    };
    let { error } = await input.supabase
      .from("itinerary_items")
      .update(richUpdate)
      .eq("trip_id", input.tripId)
      .eq("id", activity.id);
    if (error && isMissingSchemaObject(error)) {
      const { error: fallbackError } = await input.supabase
        .from("itinerary_items")
        .update({
          itinerary_day_id: activity.itinerary_day_id,
          date: dateYmd,
          activity_name: activity.title,
          title: activity.title,
          location: activity.location || "Location TBD",
          time: activity.time,
        })
        .eq("trip_id", input.tripId)
        .eq("id", activity.id);
      error = fallbackError;
    }
    if (error) throw new Error(error.message || "Could not update optimized activity.");
  }

  for (const activity of input.optimized) {
    if (existingIds.has(String(activity.id))) continue;
    toInsert.push({
      trip_id: input.tripId,
      user_id: input.userId,
      itinerary_day_id: activity.itinerary_day_id,
      date: dateYmd,
      activity_name: activity.title,
      title: activity.title,
      location: activity.location || "Location TBD",
      time: activity.time,
      priority_score: activity.priority_score,
      sunset_sensitive: activity.sunset_sensitive,
      booking_required: activity.booking_required,
      ai_generated: true,
      user_modified: activity.user_modified,
    });
  }

  if (toInsert.length > 0) {
    let { error: insertError } = await input.supabase.from("itinerary_items").insert(toInsert);
    if (insertError && isMissingSchemaObject(insertError)) {
      const fallbackInsert = input.optimized
        .filter((activity) => !existingIds.has(String(activity.id)))
        .map((activity) => ({
          trip_id: input.tripId,
          user_id: input.userId,
          itinerary_day_id: activity.itinerary_day_id,
          date: dateYmd,
          activity_name: activity.title,
          title: activity.title,
          location: activity.location || "Location TBD",
          time: activity.time,
        }));
      const { error: fallbackError } = await input.supabase
        .from("itinerary_items")
        .insert(fallbackInsert);
      insertError = fallbackError;
    }
    if (insertError)
      throw new Error(insertError.message || "Could not apply optimized additions.");
  }
}

export async function restoreRevisionSnapshot(input: {
  supabase: SupabaseClient;
  tripId: string;
  userId: string;
  revisionId: string;
}): Promise<{ restored: boolean; date?: string; reason?: string }> {
  const { data: revision, error } = await input.supabase
    .from("itinerary_revisions")
    .select("revision_reason, previous_snapshot")
    .eq("id", input.revisionId)
    .eq("trip_id", input.tripId)
    .maybeSingle();
  if (error || !revision) return { restored: false };

  const snapshot = (revision.previous_snapshot ?? {}) as {
    activities?: ItineraryOptimizationActivity[];
    affectedDates?: string[];
  };
  const activities = Array.isArray(snapshot.activities) ? snapshot.activities : [];
  if (activities.length === 0) return { restored: false };

  const datesFromSnapshot =
    Array.isArray(snapshot.affectedDates) && snapshot.affectedDates.length > 0
      ? snapshot.affectedDates.map((d) => normalizeDate(String(d))).filter(Boolean)
      : [];

  const dates =
    datesFromSnapshot.length > 0
      ? [...new Set(datesFromSnapshot)]
      : [...new Set(activities.map((a) => normalizeDate(String(a.date))).filter(Boolean))];

  for (const date of dates) {
    const dayActivities = activities.filter((a) => normalizeDate(String(a.date)) === date);
    if (dayActivities.length === 0) continue;
    await applyOptimizedActivities({
      supabase: input.supabase,
      tripId: input.tripId,
      userId: input.userId,
      date,
      optimized: dayActivities,
    });
  }

  return {
    restored: true,
    date: dates[0],
    reason: String(revision.revision_reason ?? "Undo revision"),
  };
}
