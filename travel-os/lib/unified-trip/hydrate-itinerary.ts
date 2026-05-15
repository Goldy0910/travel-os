import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedTripPlan } from "./types";
import {
  ensureItineraryDayRows,
  insertItineraryRows,
  runHydrationPipeline,
} from "./hydration/hydration-service";

export type HydrateItineraryResult = {
  insertedDays: number;
  insertedItems: number;
  skipped: boolean;
  placeMatches?: number;
  warnings?: string[];
};

export type HydrateItineraryOptions = {
  /** Resolve Google Place IDs during insert (default: false — use progressive enrich). */
  matchPlacesInline?: boolean;
};

/**
 * Writes normalized plan activities into itinerary_days + itinerary_items.
 * Non-destructive: skips when items already exist for the trip.
 */
export async function hydrateItineraryFromPlan(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  startDate: string,
  endDate: string,
  plan: NormalizedTripPlan,
  options?: HydrateItineraryOptions,
): Promise<HydrateItineraryResult> {
  const empty = { insertedDays: 0, insertedItems: 0, skipped: true };

  const { data: existingDays } = await supabase
    .from("itinerary_days")
    .select("id")
    .eq("trip_id", tripId)
    .limit(1);

  const { count: existingItemCount } = await supabase
    .from("itinerary_items")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  if ((existingItemCount ?? 0) > 0) {
    return empty;
  }

  const dayIdByDate = await ensureItineraryDayRows(
    supabase,
    tripId,
    userId,
    startDate,
    endDate,
  );

  if (dayIdByDate.size === 0) {
    return empty;
  }

  const hadDaysBefore = Boolean(existingDays && existingDays.length > 0);
  const insertedDays = hadDaysBefore ? 0 : dayIdByDate.size;

  const pipeline = await runHydrationPipeline(
    {
      tripId,
      userId,
      startDateYmd: startDate,
      endDateYmd: endDate,
      plan,
    },
    dayIdByDate,
    { matchPlacesInline: options?.matchPlacesInline ?? false },
  );

  if (pipeline.rows.length === 0) {
    return {
      insertedDays,
      insertedItems: 0,
      skipped: true,
      warnings: pipeline.warnings,
    };
  }

  const { inserted } = await insertItineraryRows(supabase, pipeline.rows);
  const placeMatches = pipeline.rows.filter((r) => r.google_place_id).length;

  return {
    insertedDays,
    insertedItems: inserted,
    skipped: inserted === 0,
    placeMatches,
    warnings: pipeline.warnings,
  };
}
