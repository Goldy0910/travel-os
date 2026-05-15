import type { MasterItineraryDay, MasterTripFile } from "@/lib/master-trip-file/types";
import type { NormalizedTripActivity, NormalizedTripDay } from "../types";
import { normalizedActivitiesFromParsedDay } from "./normalize";
import { parseItineraryStringLine, parseMasterItineraryDay } from "./parse-itinerary";
import { fallbackDayFromSummary } from "./fallbacks";

/**
 * Builds normalized activities for a single master-file day (multi-activity when summary splits).
 */
export function generateActivitiesForMasterDay(
  day: MasterItineraryDay,
  destinationName: string,
): NormalizedTripActivity[] {
  const parsed = parseMasterItineraryDay(day);
  const activities = normalizedActivitiesFromParsedDay(parsed, destinationName, day.id);
  if (activities.length > 0) return activities;
  return fallbackDayFromSummary(day, destinationName).activities;
}

export function generateNormalizedDaysFromMasterFile(
  file: MasterTripFile,
): NormalizedTripDay[] {
  const dest =
    file.destination.canonicalLocation?.trim() ||
    file.destination.name?.trim() ||
    "Destination";

  return file.itinerary.map((day) => {
    const parsed = parseMasterItineraryDay(day);
    const activities = normalizedActivitiesFromParsedDay(parsed, dest, day.id);
    return {
      dayNumber: day.dayNumber,
      title: parsed.dayTitle,
      summary: parsed.summary,
      activities:
        activities.length > 0
          ? activities
          : fallbackDayFromSummary(day, dest).activities,
    };
  });
}

export function generateNormalizedDaysFromItineraryLines(
  lines: string[],
  destinationName: string,
): NormalizedTripDay[] {
  const dest = destinationName.trim() || "Destination";
  return lines
    .filter((l) => l.trim().length > 0)
    .map((line, index) => {
      const parsed = parseItineraryStringLine(line, index);
      const dayId = `line-${index + 1}`;
      const activities = normalizedActivitiesFromParsedDay(parsed, dest, dayId);
      return {
        dayNumber: parsed.dayNumber,
        title: parsed.dayTitle,
        summary: parsed.summary,
        activities:
          activities.length > 0
            ? activities
            : fallbackDayFromSummary(
                {
                  id: dayId,
                  dayNumber: parsed.dayNumber,
                  title: parsed.dayTitle,
                  summary: parsed.summary,
                },
                dest,
              ).activities,
      };
    });
}
