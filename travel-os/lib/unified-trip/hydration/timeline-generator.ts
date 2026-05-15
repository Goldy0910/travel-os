import { enumerateDateYmd } from "@/lib/master-trip-file/dates";
import type { NormalizedTripPlan } from "../types";
import type { TimelineSlot } from "./types";

/**
 * Maps normalized plan days onto calendar dates and itinerary_day ids.
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
    .map((day) => {
      const dateYmd = allDates[day.dayNumber - 1] ?? allDates[allDates.length - 1];
      if (!dateYmd) return null;
      const itineraryDayId = dayIdByDate.get(dateYmd);
      if (itineraryDayId == null) return null;

      return {
        dateYmd,
        dayNumber: day.dayNumber,
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
