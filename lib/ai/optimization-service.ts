import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadDayActivities,
  optimizeDayPlan,
  type OptimizationContext,
} from "@/lib/ai/itinerary-optimization-engine";
import {
  applyOptimizedActivities,
  createItineraryRevision,
  restoreRevisionSnapshot,
} from "@/lib/ai/itinerary-revision-service";

function isMissingSchemaObject(error: unknown): boolean {
  const message =
    error != null && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const code =
    error != null && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  return (
    code === "PGRST205" ||
    /column .* does not exist/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
}

export async function runOptimizationForDay(input: {
  supabase: SupabaseClient;
  tripId: string;
  userId: string;
  date: string;
  context: OptimizationContext;
}): Promise<{
  revisionId: string | null;
  removedActivityIds: string[];
  delayedActivityIds: string[];
  updatedCount: number;
  reasoning: string;
}> {
  const before = await loadDayActivities(input.supabase, input.tripId, input.date);
  const result = optimizeDayPlan(before, input.context);

  for (const activityId of result.removedActivityIds) {
    const { error } = await input.supabase.from("itinerary_activity_state").insert({
      activity_id: activityId,
      status: "skipped",
      skipped_reason: `optimization:${input.context.scenario}`,
    });
    if (error && !isMissingSchemaObject(error)) {
      throw new Error(error.message || "Could not save activity state.");
    }
  }
  for (const activityId of result.delayedActivityIds) {
    const { error } = await input.supabase.from("itinerary_activity_state").insert({
      activity_id: activityId,
      status: "delayed",
      delay_minutes: input.context.delayMinutes ?? null,
    });
    if (error && !isMissingSchemaObject(error)) {
      throw new Error(error.message || "Could not save delay state.");
    }
  }

  await applyOptimizedActivities({
    supabase: input.supabase,
    tripId: input.tripId,
    userId: input.userId,
    date: input.date,
    optimized: result.updatedActivities,
  });

  const revisionId = await createItineraryRevision({
    supabase: input.supabase,
    tripId: input.tripId,
    revisionReason: `optimization:${input.context.scenario}`,
    previous: { activities: before },
    updated: { activities: result.updatedActivities },
  });

  return {
    revisionId,
    removedActivityIds: result.removedActivityIds,
    delayedActivityIds: result.delayedActivityIds,
    updatedCount: result.updatedActivities.length,
    reasoning: result.reasoning,
  };
}

export async function undoItineraryRevision(input: {
  supabase: SupabaseClient;
  tripId: string;
  userId: string;
  revisionId: string;
}) {
  return restoreRevisionSnapshot(input);
}
