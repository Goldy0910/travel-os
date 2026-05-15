import "server-only";

import type { MasterTripFile } from "@/lib/master-trip-file/types";
import { tripDatesFromDayCount } from "@/lib/master-trip-file/dates";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizedPlanFromMasterFile } from "./from-master-file";
import { hydrateItineraryFromPlan } from "./hydrate-itinerary";

/**
 * If a linked master file has plan days but the trip workspace has no activities yet,
 * hydrate itinerary_items from the normalized plan (one-time, non-destructive).
 */
export async function ensureTripItineraryHydrated(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  masterFile: MasterTripFile,
  options: {
    masterTripFileId: string;
    startDateYmd: string;
    endDateYmd: string;
    weatherHint?: string;
  },
): Promise<boolean> {
  if (masterFile.itinerary.length === 0) return false;

  const { count } = await supabase
    .from("itinerary_items")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  if ((count ?? 0) > 0) return false;

  let startDate = options.startDateYmd;
  let endDate = options.endDateYmd;

  if (!startDate || !endDate) {
    const derived = tripDatesFromDayCount(masterFile.preferences.days);
    startDate = derived.startDate;
    endDate = derived.endDate;
  }

  const plan = normalizedPlanFromMasterFile(masterFile, {
    tripId,
    masterTripFileId: options.masterTripFileId,
    weatherHint: options.weatherHint,
  });

  const result = await hydrateItineraryFromPlan(
    supabase,
    tripId,
    userId,
    startDate,
    endDate,
    plan,
  );

  return result.insertedItems > 0;
}
