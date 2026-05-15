import type { SupabaseClient } from "@supabase/supabase-js";
import { buildChangePreview, sanitizePatchForUserEdits } from "./preview";
import { applyItineraryRefinementPatch } from "./apply-patch";
import { runItineraryRulesRefinement } from "./rules-engine";
import { loadTripItineraryActivities } from "./snapshot";
import type {
  ApplyItineraryPatchResult,
  ItineraryRefinementChange,
  ItineraryRefinementPatch,
  RefinementEngineInput,
} from "./types";

export type PreviewItineraryRefinementResult = {
  patch: ItineraryRefinementPatch;
  changes: ItineraryRefinementChange[];
  source: "ai" | "rules";
};

export async function previewItineraryRefinement(input: {
  supabase: SupabaseClient;
  tripId: string;
  destination: string;
  message: string;
  quickActionId?: string;
}): Promise<PreviewItineraryRefinementResult> {
  const activities = await loadTripItineraryActivities(input.supabase, input.tripId);
  const engineInput: RefinementEngineInput = {
    tripId: input.tripId,
    destination: input.destination,
    message: input.message,
    quickActionId: input.quickActionId,
    activities,
  };

  const result = runItineraryRulesRefinement(engineInput);
  const patch = sanitizePatchForUserEdits(result.patch, activities);
  const changes = buildChangePreview(activities, patch);

  return {
    patch,
    changes,
    source: result.source,
  };
}

export async function applyItineraryRefinement(input: {
  supabase: SupabaseClient;
  tripId: string;
  userId: string;
  patch: ItineraryRefinementPatch;
}): Promise<ApplyItineraryPatchResult> {
  return applyItineraryRefinementPatch(input);
}

export { loadTripItineraryActivities } from "./snapshot";
export type {
  ItineraryRefinementPatch,
  ItineraryRefinementChange,
  ItineraryItemPatchOp,
  ApplyItineraryPatchResult,
} from "./types";
