import type { SupabaseClient } from "@supabase/supabase-js";
import { hydrateItineraryFromPlan } from "@/lib/unified-trip/hydrate-itinerary";
import { normalizedPlanFromMasterFile } from "@/lib/unified-trip/from-master-file";
import type { MasterItineraryDay, MasterTripFile } from "./types";

/** Seeds itinerary_days + itinerary_items via unified hydration (non-destructive). */
export async function seedItineraryFromMasterFile(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  startDate: string,
  endDate: string,
  days: MasterItineraryDay[],
  fileContext?: Pick<
    MasterTripFile,
    "destination" | "recommendation" | "practical" | "preferences"
  >,
): Promise<void> {
  const stubFile: MasterTripFile = fileContext
    ? ({
        schemaVersion: 1,
        preferences: fileContext.preferences,
        destination: fileContext.destination,
        recommendation: fileContext.recommendation,
        practical: fileContext.practical,
        itinerary: days,
        refinementHistory: [],
        edits: [],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: "homepage",
        },
      } as MasterTripFile)
    : ({
        schemaVersion: 1,
        preferences: { days: days.length, priorities: [] },
        destination: {
          name: "Trip",
          slug: null,
          canonicalLocation: "",
        },
        recommendation: {
          mode: "recommendation",
          whyItFits: [],
          explanation: "",
          travelEffort: "",
          budgetEstimate: "",
          alternatives: [],
        },
        practical: {
          travelEffort: "",
          budgetEstimate: "",
        },
        itinerary: days,
        refinementHistory: [],
        edits: [],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: "homepage",
        },
      } as MasterTripFile);

  const plan = normalizedPlanFromMasterFile(stubFile, { tripId });
  await hydrateItineraryFromPlan(supabase, tripId, userId, startDate, endDate, plan);
}
