import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItineraryOptimizationActivity } from "@/lib/ai/itinerary-optimization-engine";
import type { TripItinerarySnapshot } from "./types";

function normalizeDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw).trim());
  if (m) return m[1]!;
  return "";
}

export function rowToActivity(row: Record<string, unknown>): ItineraryOptimizationActivity {
  return {
    id: String(row.id),
    trip_id: String(row.trip_id ?? ""),
    itinerary_day_id: row.itinerary_day_id as string | number | null,
    date: normalizeDate(String(row.date ?? "")),
    title: String(row.title || row.activity_name || "Activity"),
    location: String(row.location || "Location TBD"),
    time: row.time != null ? String(row.time) : null,
    priority_score:
      typeof row.priority_score === "number" ? row.priority_score : null,
    sunset_sensitive: row.sunset_sensitive === true,
    booking_required: row.booking_required === true,
    ai_generated: row.ai_generated === true,
    user_modified: row.user_modified === true,
  };
}

export async function loadTripItineraryActivities(
  supabase: SupabaseClient,
  tripId: string,
): Promise<ItineraryOptimizationActivity[]> {
  const { data, error } = await supabase
    .from("itinerary_items")
    .select(
      "id, trip_id, itinerary_day_id, date, activity_name, title, location, time, priority_score, sunset_sensitive, booking_required, ai_generated, user_modified",
    )
    .eq("trip_id", tripId)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => rowToActivity(row as Record<string, unknown>));
}

export function snapshotForDates(
  activities: ItineraryOptimizationActivity[],
  affectedDates: string[],
): TripItinerarySnapshot {
  const dateSet = new Set(affectedDates);
  return {
    scope: "itinerary_refine",
    affectedDates: [...affectedDates],
    activities: activities.filter((a) => dateSet.has(a.date)),
  };
}

export function activitiesByDate(
  activities: ItineraryOptimizationActivity[],
): Map<string, ItineraryOptimizationActivity[]> {
  const map = new Map<string, ItineraryOptimizationActivity[]>();
  for (const a of activities) {
    if (!a.date) continue;
    const list = map.get(a.date) ?? [];
    list.push(a);
    map.set(a.date, list);
  }
  return map;
}
