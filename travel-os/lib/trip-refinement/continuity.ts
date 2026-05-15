import type { MasterItineraryDay, MasterTripPreferences } from "@/lib/master-trip-file/types";
import type { TripPriority } from "@/lib/homepage-decision/types";

/** Re-number day titles after structural changes while preserving stable ids. */
export function reindexItineraryDays(days: MasterItineraryDay[]): MasterItineraryDay[] {
  return days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day, idx) => ({
      ...day,
      dayNumber: idx + 1,
      title: day.title?.match(/^Day\s+\d+/i) ? `Day ${idx + 1}` : day.title,
    }));
}

/** Merge preference priorities without duplicates. */
export function mergePriorities(
  current: TripPriority[],
  add: TripPriority[],
): TripPriority[] {
  const set = new Set<TripPriority>(current);
  for (const p of add) set.add(p);
  return [...set];
}
