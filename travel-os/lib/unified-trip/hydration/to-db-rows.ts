import type { NormalizedTripActivity } from "../types";
import type { ItineraryItemInsertRow, TimelineSlot } from "./types";
import { mergeNotesWithDescription } from "./fallbacks";
import { normalizeActivityTitle, normalizeCategory, normalizeClockTime } from "./normalize";

export function normalizedActivityToDbRow(
  activity: NormalizedTripActivity,
  context: {
    tripId: string;
    userId: string;
    itineraryDayId: string | number;
    dateYmd: string;
    defaultLocation: string;
  },
): ItineraryItemInsertRow {
  const title = normalizeActivityTitle(activity.title);
  const location =
    activity.location?.trim() || context.defaultLocation || "Location TBD";
  const time = normalizeClockTime(activity.startTime) ?? "10:00";
  const notes = mergeNotesWithDescription(activity);

  const row: ItineraryItemInsertRow = {
    trip_id: context.tripId,
    user_id: context.userId,
    itinerary_day_id: context.itineraryDayId,
    date: context.dateYmd,
    activity_name: activity.description?.trim() || title,
    title,
    location,
    time,
    ai_generated: true,
    category: normalizeCategory(activity.category),
  };

  if (notes) row.notes = notes;
  if (activity.placeId?.trim()) row.google_place_id = activity.placeId.trim();

  return row;
}

export function timelineSlotsToDbRows(
  slots: TimelineSlot[],
  context: {
    tripId: string;
    userId: string;
    defaultLocation: string;
  },
): ItineraryItemInsertRow[] {
  return slots.flatMap((slot) =>
    slot.activities.map((activity) =>
      normalizedActivityToDbRow(activity, {
        tripId: context.tripId,
        userId: context.userId,
        itineraryDayId: slot.itineraryDayId,
        dateYmd: slot.dateYmd,
        defaultLocation: context.defaultLocation,
      }),
    ),
  );
}

/** Base columns always present on itinerary_items. */
export function toBaseInsertRow(row: ItineraryItemInsertRow): Record<string, unknown> {
  return {
    trip_id: row.trip_id,
    user_id: row.user_id,
    itinerary_day_id: row.itinerary_day_id,
    date: row.date,
    activity_name: row.activity_name,
    title: row.title,
    location: row.location,
    time: row.time,
    ai_generated: row.ai_generated,
  };
}

export function toExtendedInsertRow(row: ItineraryItemInsertRow): Record<string, unknown> {
  return {
    ...toBaseInsertRow(row),
    ...(row.google_place_id ? { google_place_id: row.google_place_id } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.category ? { category: row.category } : {}),
  };
}
