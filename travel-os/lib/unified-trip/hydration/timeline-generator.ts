import { enumerateDateYmd } from "@/lib/master-trip-file/dates";
import type { NormalizedTripPlan } from "../types";
import type { TimelineSlot } from "./types";

/**
 * Maps normalized plan days onto calendar dates and itinerary_day ids.
 * Uses each day's position in the plan (1st plan day → 1st trip date), not `dayNumber`
 * from AI text — duplicate "Day 1" labels in recommendations must not collapse days.
 */
export function buildTimelineSlots(
  plan: NormalizedTripPlan,
  startDateYmd: string,
  endDateYmd: string,
  dayIdByDate: Map<string, string | number>,
): TimelineSlot[] {
  const allDates = enumerateDateYmd(startDateYmd, endDateYmd);
  if (allDates.length === 0) return [];

  return plan.days
    .map((day, index) => {
      const dateYmd = allDates[index];
      if (!dateYmd) return null;
      const itineraryDayId = dayIdByDate.get(dateYmd);
      if (itineraryDayId == null) return null;

      return {
        dateYmd,
        dayNumber: index + 1,
        itineraryDayId,
        activities: day.activities,
      };
    })
    .filter((slot): slot is TimelineSlot => slot != null);
}

export function staggerActivityTimes(slots: TimelineSlot[]): TimelineSlot[] {
  const defaultTimes = ["09:30", "13:00", "17:00", "20:00"];

  return slots.map((slot) => ({
    ...slot,
    activities: slot.activities.map((activity, index) => ({
      ...activity,
      startTime:
        activity.startTime?.trim() ||
        defaultTimes[index % defaultTimes.length] ||
        "10:00",
    })),
  }));
}
