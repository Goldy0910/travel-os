import type { MasterItineraryDay } from "@/lib/master-trip-file/types";
import type { NormalizedTripActivity, NormalizedTripDay, NormalizedTripPlan } from "../types";
import { parsedSegmentToNormalizedActivity } from "./normalize";

const DEFAULT_TIME = "10:00";

/**
 * Single-activity fallback when parsing yields nothing usable.
 */
export function fallbackDayFromSummary(
  day: MasterItineraryDay,
  destinationName: string,
): NormalizedTripDay {
  const summary = day.summary.trim() || day.title.trim() || `Day ${day.dayNumber}`;
  const activity = parsedSegmentToNormalizedActivity(
    {
      title: day.title.trim() || `Day ${day.dayNumber}`,
      description: summary,
      categoryHint: "sightseeing",
    },
    {
      id: `${day.id}-a0`,
      destinationName,
      slotIndex: 0,
      explicitTime: DEFAULT_TIME,
    },
  );

  return {
    dayNumber: day.dayNumber,
    title: day.title.trim() || `Day ${day.dayNumber}`,
    summary,
    activities: [activity],
  };
}

export function fallbackPlanFromDestination(
  destinationName: string,
  dayCount: number,
): NormalizedTripPlan {
  const name = destinationName.trim() || "Trip";
  const days: NormalizedTripDay[] = Array.from({ length: Math.max(1, dayCount) }, (_, i) => {
    const dayNumber = i + 1;
    const id = `fallback-day-${dayNumber}`;
    return fallbackDayFromSummary(
      {
        id,
        dayNumber,
        title: `Day ${dayNumber}`,
        summary: `Explore ${name}`,
      },
      name,
    );
  });

  return {
    destination: { name, canonicalLocation: name },
    summary: `Your ${dayCount}-day plan for ${name}`,
    whyThisFits: [],
    budget: "",
    travelEffort: "",
    recommendationExplanation: "",
    days,
  };
}

export function mergeNotesWithDescription(
  activity: NormalizedTripActivity,
): string | null {
  const notes = activity.notes?.trim() ?? "";
  const desc = activity.description?.trim() ?? "";
  if (notes && desc && notes !== desc) return `${notes} — ${desc}`;
  return notes || desc || null;
}
