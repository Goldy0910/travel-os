export type {
  HydrationContext,
  HydrationPipelineResult,
  ItineraryItemInsertRow,
  ParsedActivitySegment,
  ParsedItinerarySegment,
  PlaceMatchInput,
  PlaceMatchResult,
  TimelineSlot,
} from "./types";

export {
  parseItineraryStringLine,
  parseMasterItineraryDay,
  splitSummaryIntoActivitySegments,
} from "./parse-itinerary";

export {
  normalizeActivityTitle,
  normalizeCategory,
  normalizeClockTime,
  normalizedActivitiesFromParsedDay,
} from "./normalize";

export {
  generateActivitiesForMasterDay,
  generateNormalizedDaysFromItineraryLines,
  generateNormalizedDaysFromMasterFile,
} from "./activity-generator";

export { fallbackDayFromSummary, fallbackPlanFromDestination } from "./fallbacks";

export { buildTimelineSlots, staggerActivityTimes } from "./timeline-generator";

export {
  normalizedActivityToDbRow,
  timelineSlotsToDbRows,
  toBaseInsertRow,
  toExtendedInsertRow,
} from "./to-db-rows";
