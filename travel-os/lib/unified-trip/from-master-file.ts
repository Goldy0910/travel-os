import type { MasterTripFile } from "@/lib/master-trip-file/types";
import { generateNormalizedDaysFromMasterFile } from "./hydration/activity-generator";
import type { NormalizedTripPlan } from "./types";

export { generateNormalizedDaysFromMasterFile as masterFileDaysToNormalizedDays };

export function normalizedPlanFromMasterFile(
  file: MasterTripFile,
  options?: {
    tripId?: string | null;
    masterTripFileId?: string | null;
    weatherHint?: string;
  },
): NormalizedTripPlan {
  return {
    tripId: options?.tripId ?? null,
    masterTripFileId: options?.masterTripFileId ?? null,
    destination: {
      name: file.destination.name,
      canonicalLocation: file.destination.canonicalLocation,
      slug: file.destination.slug,
      country: file.destination.country,
    },
    summary: file.recommendation.explanation,
    whyThisFits: file.recommendation.whyItFits,
    budget: file.practical.budgetEstimate,
    travelEffort: file.practical.travelEffort,
    weather: options?.weatherHint,
    recommendationExplanation: file.recommendation.explanation,
    days: generateNormalizedDaysFromMasterFile(file),
  };
}
