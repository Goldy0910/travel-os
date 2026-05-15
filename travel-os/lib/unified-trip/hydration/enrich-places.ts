import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { matchPlaceForActivity } from "./place-matching";

export type EnrichPlacesResult = {
  scanned: number;
  matched: number;
  updated: number;
};

type ItemRow = {
  id: string | number;
  title: string | null;
  activity_name: string | null;
  location: string | null;
  google_place_id?: string | null;
};

/**
 * Progressive hydration: attach google_place_id to AI items that lack one.
 */
export async function enrichTripItineraryPlaces(
  supabase: SupabaseClient,
  tripId: string,
  destination: string,
  options?: { limit?: number },
): Promise<EnrichPlacesResult> {
  const limit = options?.limit ?? 24;

  const { data: items, error } = await supabase
    .from("itinerary_items")
    .select("id, title, activity_name, location, google_place_id")
    .eq("trip_id", tripId)
    .eq("ai_generated", true)
    .limit(limit);

  if (error || !items?.length) {
    return { scanned: 0, matched: 0, updated: 0 };
  }

  const pending = (items as ItemRow[]).filter((row) => !row.google_place_id?.trim());
  let matched = 0;
  let updated = 0;

  for (const row of pending) {
    const title = (row.title || row.activity_name || "Activity").trim();
    const location = (row.location || destination).trim();
    const result = await matchPlaceForActivity({
      activityKey: String(row.id),
      title,
      location,
      destination,
    });

    if (!result.placeId) continue;
    matched += 1;

    const { error: updateError } = await supabase
      .from("itinerary_items")
      .update({ google_place_id: result.placeId })
      .eq("id", row.id)
      .eq("trip_id", tripId);

    if (!updateError) updated += 1;
  }

  return { scanned: pending.length, matched, updated };
}

export async function tripNeedsPlaceEnrichment(
  supabase: SupabaseClient,
  tripId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("itinerary_items")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("ai_generated", true)
    .is("google_place_id", null);

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("google_place_id")) return false;
    return false;
  }

  return (count ?? 0) > 0;
}
