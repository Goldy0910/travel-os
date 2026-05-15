import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { enumerateDateYmd } from "@/lib/master-trip-file/dates";
import type { NormalizedTripPlan } from "../types";
import { enrichActivitiesWithPlaces } from "./place-matching";
import { buildTimelineSlots, staggerActivityTimes } from "./timeline-generator";
import {
  timelineSlotsToDbRows,
  toBaseInsertRow,
  toExtendedInsertRow,
} from "./to-db-rows";
import type { HydrationContext, HydrationPipelineResult, ItineraryItemInsertRow } from "./types";

export type RunHydrationPipelineOptions = {
  /** When true, resolves Google Place IDs before insert (slower). */
  matchPlacesInline?: boolean;
  maxInlinePlaceMatches?: number;
};

/**
 * Full AI → itinerary transformation: timeline mapping, optional place match, DB rows.
 */
export async function runHydrationPipeline(
  context: HydrationContext,
  dayIdByDate: Map<string, string | number>,
  options?: RunHydrationPipelineOptions,
): Promise<HydrationPipelineResult> {
  const warnings: string[] = [];
  const defaultLocation =
    context.plan.destination.canonicalLocation ||
    context.plan.destination.name ||
    "";

  let plan = context.plan;

  if (options?.matchPlacesInline) {
    const allActivities = plan.days.flatMap((d) => d.activities);
    const { enriched, matchCount } = await enrichActivitiesWithPlaces(
      allActivities,
      defaultLocation,
      { maxMatches: options.maxInlinePlaceMatches ?? 12 },
    );
    if (matchCount === 0) {
      warnings.push("place_match_none");
    }
    let cursor = 0;
    plan = {
      ...plan,
      days: plan.days.map((day) => {
        const count = day.activities.length;
        const slice = enriched.slice(cursor, cursor + count);
        cursor += count;
        return { ...day, activities: slice };
      }),
    };
  }

  const slots = staggerActivityTimes(
    buildTimelineSlots(plan, context.startDateYmd, context.endDateYmd, dayIdByDate),
  );

  if (slots.length === 0) {
    warnings.push("timeline_empty");
  }

  const rows = timelineSlotsToDbRows(slots, {
    tripId: context.tripId,
    userId: context.userId,
    defaultLocation,
  });

  if (rows.length === 0) {
    warnings.push("no_rows");
  }

  return { rows, days: plan.days, warnings };
}

export function isMissingOptionalColumnError(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("google_place_id") ||
    msg.includes("notes") ||
    msg.includes("category") ||
    msg.includes("column") && msg.includes("does not exist")
  );
}

/**
 * Inserts rows; retries with base columns if optional metadata columns are missing.
 */
export async function insertItineraryRows(
  supabase: SupabaseClient,
  rows: ItineraryItemInsertRow[],
): Promise<{ inserted: number; usedExtendedColumns: boolean }> {
  if (rows.length === 0) return { inserted: 0, usedExtendedColumns: false };

  const extendedPayload = rows.map(toExtendedInsertRow);
  const { error: extendedError } = await supabase
    .from("itinerary_items")
    .insert(extendedPayload);

  if (!extendedError) {
    return { inserted: rows.length, usedExtendedColumns: true };
  }

  if (!isMissingOptionalColumnError(extendedError)) {
    return { inserted: 0, usedExtendedColumns: false };
  }

  const basePayload = rows.map(toBaseInsertRow);
  const { error: baseError } = await supabase.from("itinerary_items").insert(basePayload);
  if (baseError) return { inserted: 0, usedExtendedColumns: false };
  return { inserted: rows.length, usedExtendedColumns: false };
}

export async function ensureItineraryDayRows(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  startDateYmd: string,
  endDateYmd: string,
): Promise<Map<string, string | number>> {
  const allDates = enumerateDateYmd(startDateYmd, endDateYmd);
  const map = new Map<string, string | number>();

  const { data: existing } = await supabase
    .from("itinerary_days")
    .select("id, date")
    .eq("trip_id", tripId);

  for (const row of existing ?? []) {
    if (row.date != null) map.set(String(row.date), row.id);
  }

  const missing = allDates.filter((d) => !map.has(d));
  if (missing.length === 0) return map;

  const { data: created } = await supabase
    .from("itinerary_days")
    .insert(missing.map((date) => ({ trip_id: tripId, user_id: userId, date })))
    .select("id, date");

  for (const row of created ?? []) {
    if (row.date != null) map.set(String(row.date), row.id);
  }

  return map;
}
