import type { HomepageDecisionResponse } from "@/lib/homepage-decision/types";
import type { MasterTripPreferences } from "@/lib/master-trip-file/types";
import { buildMasterTripFile } from "@/lib/master-trip-file/build";
import { generateNormalizedDaysFromItineraryLines } from "./hydration/activity-generator";
import { normalizedPlanFromMasterFile } from "./from-master-file";
import type { NormalizedTripPlan } from "./types";

export function normalizedPlanFromHomepageDecision(
  decision: HomepageDecisionResponse,
  preferences: MasterTripPreferences,
  options?: { tripId?: string | null; masterTripFileId?: string | null; weatherHint?: string },
): NormalizedTripPlan {
  const file = buildMasterTripFile({
    decision,
    preferences,
    source: "homepage",
  });
  return normalizedPlanFromMasterFile(file, options);
}

/** Re-export for callers that only have itinerary string lines. */
export function normalizedDaysFromItineraryLines(
  lines: string[],
  destinationName: string,
): NormalizedTripPlan["days"] {
  return generateNormalizedDaysFromItineraryLines(lines, destinationName);
}
