import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enumerateTripDates,
  generateAiItineraryDraft,
} from "@/app/app/trip/[id]/_lib/itinerary-bootstrap-ai";
import {
  markItinerarySetupComplete,
  normalizeTripDateInput,
  pickFirstTripDateValue,
  replaceItineraryWithDraft,
  type DraftActivityRow,
} from "@/app/app/trip/[id]/_lib/itinerary-persist";

export type GenerateAndPersistItineraryInput = {
  supabase: SupabaseClient;
  tripId: string;
  userId: string;
  preferences?: string;
  pace?: "relaxed" | "balanced" | "packed";
  /** When false and the trip already has items, skip generation. Default true for UI/action parity. */
  replaceExisting?: boolean;
};

export type GenerateAndPersistItineraryResult =
  | {
      ok: true;
      activityCount: number;
      dayCount: number;
      dates: string[];
      destination: string;
      replaced: boolean;
    }
  | {
      ok: false;
      error: string;
      code?: "UNAUTHORIZED" | "INVALID_INPUT" | "NEEDS_CONFIRMATION" | "GENERATION_FAILED";
      existingActivityCount?: number;
    };

function paceHint(pace?: "relaxed" | "balanced" | "packed"): string {
  if (pace === "relaxed") return "Prefer a relaxed pace with fewer activities and buffer time.";
  if (pace === "packed") return "Prefer a packed pace with fuller days and efficient sequencing.";
  if (pace === "balanced") return "Prefer a balanced pace.";
  return "";
}

/**
 * Generate a day-by-day AI itinerary and persist it to itinerary_days / itinerary_items.
 * Shared by the itinerary setup action and the generate_itinerary tool.
 */
export async function generateAndPersistItinerary(
  input: GenerateAndPersistItineraryInput,
): Promise<GenerateAndPersistItineraryResult> {
  const tripId = input.tripId.trim();
  if (!tripId) {
    return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
  }

  const { data: trip, error: tripError } = await input.supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError) {
    return { ok: false, error: tripError.message, code: "GENERATION_FAILED" };
  }
  if (!trip) {
    return { ok: false, error: "Trip not found", code: "INVALID_INPUT" };
  }

  const row = trip as Record<string, unknown>;
  const destination =
    String(row.destination ?? row.location ?? row.city ?? row.place ?? "").trim() ||
    "Destination";
  const startDate = normalizeTripDateInput(
    pickFirstTripDateValue(row, ["start_date", "startDate", "date_from"]),
  );
  const endDate = normalizeTripDateInput(
    pickFirstTripDateValue(row, ["end_date", "endDate", "date_to"]),
  );
  const tripDates = enumerateTripDates(startDate, endDate);
  if (tripDates.length === 0) {
    return {
      ok: false,
      error: "Trip dates are invalid. Please update trip dates first.",
      code: "INVALID_INPUT",
    };
  }

  const replaceExisting = input.replaceExisting !== false;

  const { count: existingCount, error: countError } = await input.supabase
    .from("itinerary_items")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  if (countError) {
    return { ok: false, error: countError.message, code: "GENERATION_FAILED" };
  }

  const existingActivityCount = existingCount ?? 0;
  if (!replaceExisting && existingActivityCount > 0) {
    return {
      ok: false,
      error:
        "This trip already has an itinerary. Call again with replaceExisting=true to regenerate it.",
      code: "NEEDS_CONFIRMATION",
      existingActivityCount,
    };
  }

  const preferenceParts = [
    input.preferences?.trim() || "",
    paceHint(input.pace),
  ].filter(Boolean);
  const interests = preferenceParts.join(" ").trim();

  let draft: DraftActivityRow[];
  try {
    draft = await generateAiItineraryDraft({
      destination,
      tripDates,
      interests: interests || undefined,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message.trim() : "";
    return {
      ok: false,
      error: reason ? `AI generation failed: ${reason}` : "AI generation failed. Please retry.",
      code: "GENERATION_FAILED",
    };
  }

  if (draft.length === 0) {
    return {
      ok: false,
      error: "AI generation failed. Please retry.",
      code: "GENERATION_FAILED",
    };
  }

  try {
    await replaceItineraryWithDraft(input.supabase, tripId, input.userId, draft);
  } catch (e) {
    const reason = e instanceof Error ? e.message.trim() : "";
    return {
      ok: false,
      error: reason || "Could not save generated itinerary.",
      code: "GENERATION_FAILED",
    };
  }

  const flagged = await markItinerarySetupComplete(input.supabase, tripId);
  if (!flagged.ok) {
    return { ok: false, error: flagged.message, code: "GENERATION_FAILED" };
  }

  const dates = Array.from(new Set(draft.map((d) => d.date))).sort();
  return {
    ok: true,
    activityCount: draft.length,
    dayCount: dates.length,
    dates,
    destination,
    replaced: existingActivityCount > 0,
  };
}
