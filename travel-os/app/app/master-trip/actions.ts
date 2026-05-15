"use server";

import { getFallbackTravelPlaceBySlug } from "@/app/app/create-trip/travel-places-fallback";
import {
  addRefinementEntry,
  buildMasterTripFile,
  mergeDecisionIntoFile,
  touchMasterTripFile,
  tripDatesFromDayCount,
  seedItineraryFromMasterFile,
  parseMasterTripFile,
  type MasterItineraryDay,
  type MasterTripFile,
  type MasterTripPreferences,
} from "@/lib/master-trip-file";
import type { HomepageDecisionResponse } from "@/lib/homepage-decision/types";
import { engineResultToHomepagePayload } from "@/lib/recommendation-engine/adapters/homepage";
import { decideFromHomepageRequest } from "@/lib/recommendation-engine/integration/hooks";
import type { HomepageDecisionRequest } from "@/lib/homepage-decision/types";
import { actionError, actionSuccess, type FormActionResult } from "@/lib/form-action-result";
import { isMissingTripMasterFilesTable } from "@/lib/supabase-schema-errors";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function getAuthContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  let user = authUser;
  if (!user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    user = session?.user ?? null;
  }
  if (!user) return null;
  return { supabase, user };
}

async function loadOwnedMasterFile(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, id: string, userId: string) {
  const { data, error } = await supabase
    .from("trip_master_files")
    .select("id, user_id, trip_id, version, data")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const parsed = parseMasterTripFile(data.data);
  if (!parsed) return null;
  return {
    id: String(data.id),
    tripId: data.trip_id ? String(data.trip_id) : null,
    version: Number(data.version) || 1,
    file: parsed,
  };
}

async function createLinkedTrip(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  userEmail: string,
  userMeta: Record<string, unknown> | undefined,
  title: string,
  location: string,
  startDate: string,
  endDate: string,
): Promise<string | null> {
  const tripTitle = title.trim() || location.split(",")[0]?.trim() || location;
  const tripLocation = location.trim() || tripTitle;

  const { data: newTrip, error } = await supabase
    .from("trips")
    .insert({
      user_id: userId,
      location: tripLocation,
      start_date: startDate,
      end_date: endDate,
      title: tripTitle,
      itinerary_setup_complete: true,
    })
    .select("id")
    .single();

  if (error || !newTrip?.id) return null;
  const tripId = String(newTrip.id);
  const organizerName =
    (typeof userMeta?.full_name === "string" && userMeta.full_name.trim()) ||
    userEmail.split("@")[0] ||
    "Organizer";

  const { error: memberError } = await supabase.from("members").insert({
    trip_id: tripId,
    user_id: userId,
    name: organizerName,
    email: userEmail,
    role: "organizer",
  });

  if (memberError) {
    await supabase.from("trips").delete().eq("id", tripId);
    return null;
  }
  return tripId;
}

async function resolveCanonicalLocation(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  slug: string | null | undefined,
  fallback: string,
): Promise<string> {
  if (slug) {
    const { data } = await supabase
      .from("travel_places")
      .select("canonical_location")
      .eq("slug", slug)
      .maybeSingle();
    if (data?.canonical_location) return String(data.canonical_location).trim();
    const fb = getFallbackTravelPlaceBySlug(slug);
    if (fb?.canonical_location) return fb.canonical_location.trim();
  }
  return fallback.trim() || "Unknown";
}

/**
 * Homepage-saved plans without a linked trip appear in the main trips list once
 * we create the trip row and attach trip_id on the master file.
 */
export async function ensureUserMasterFilesLinkedToTrips(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
): Promise<void> {
  const { data: orphans, error } = await supabase
    .from("trip_master_files")
    .select("id, data")
    .eq("user_id", user.id)
    .is("trip_id", null)
    .order("updated_at", { ascending: false })
    .limit(25);

  if (error) {
    if (isMissingTripMasterFilesTable(error)) return;
    return;
  }
  if (!orphans?.length) return;

  for (const row of orphans) {
    const file = parseMasterTripFile(row.data);
    if (!file) continue;

    const tripTitle = file.destination.name;
    const location = await resolveCanonicalLocation(
      supabase,
      file.destination.slug,
      file.destination.canonicalLocation || file.destination.name,
    );
    const { startDate, endDate } = tripDatesFromDayCount(file.preferences.days);
    const tripId = await createLinkedTrip(
      supabase,
      user.id,
      user.email ?? "",
      user.user_metadata,
      tripTitle,
      location,
      startDate,
      endDate,
    );
    if (!tripId) continue;

    await supabase
      .from("trip_master_files")
      .update({ trip_id: tripId, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    await seedItineraryFromMasterFile(
      supabase,
      tripId,
      user.id,
      startDate,
      endDate,
      file.itinerary,
      file,
    );
  }
}

/** Continue Planning when `trip_master_files` migration is not applied yet. */
async function saveRecommendationWithoutMasterTable(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>["user"],
  masterFile: MasterTripFile,
  location: string,
  startDate: string,
  endDate: string,
): Promise<FormActionResult> {
  const tripId = await createLinkedTrip(
    supabase,
    user.id,
    user.email ?? "",
    user.user_metadata,
    masterFile.destination.name,
    location,
    startDate,
    endDate,
  );

  if (!tripId) {
    return actionError("Could not create your trip. Try again.");
  }

  await seedItineraryFromMasterFile(
    supabase,
    tripId,
    user.id,
    startDate,
    endDate,
    masterFile.itinerary,
    masterFile,
  );

  revalidatePath("/app/trips");
  revalidatePath("/app/home");
  revalidatePath(`/app/trip/${tripId}`);

  return actionSuccess(
    "Trip ready — opening your plan.",
    `/app/trip/${encodeURIComponent(tripId)}?welcome=1&from=recommendation`,
  );
}

export async function saveMasterTripAction(formData: FormData): Promise<FormActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return actionError("Sign in to save your trip.");
  }
  const { supabase, user } = ctx;

  let payload: {
    decision: HomepageDecisionResponse;
    preferences: MasterTripPreferences;
    travelPlaceSlug?: string | null;
  };
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return actionError("Invalid save payload.");
  }

  if (!payload.decision || !payload.preferences?.days) {
    return actionError("Missing trip data to save.");
  }

  const masterFile = buildMasterTripFile({
    decision: payload.decision,
    preferences: payload.preferences,
    source: "homepage",
  });

  const tripTitle = masterFile.destination.name;
  const location = await resolveCanonicalLocation(
    supabase,
    payload.travelPlaceSlug ?? masterFile.destination.slug,
    masterFile.destination.canonicalLocation || masterFile.destination.name,
  );

  const { startDate, endDate } = tripDatesFromDayCount(payload.preferences.days);

  const { data: inserted, error: insertError } = await supabase
    .from("trip_master_files")
    .insert({
      user_id: user.id,
      version: 1,
      data: masterFile,
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    if (isMissingTripMasterFilesTable(insertError)) {
      return saveRecommendationWithoutMasterTable(
        supabase,
        user,
        masterFile,
        location,
        startDate,
        endDate,
      );
    }
    return actionError(insertError?.message ?? "Could not save master trip file.");
  }

  const masterId = String(inserted.id);
  const tripId = await createLinkedTrip(
    supabase,
    user.id,
    user.email ?? "",
    user.user_metadata,
    tripTitle,
    location,
    startDate,
    endDate,
  );

  if (tripId) {
    await supabase.from("trip_master_files").update({ trip_id: tripId }).eq("id", masterId);
    await seedItineraryFromMasterFile(
      supabase,
      tripId,
      user.id,
      startDate,
      endDate,
      masterFile.itinerary,
      masterFile,
    );
  }

  revalidatePath("/app/trips");
  revalidatePath("/app/home");
  revalidatePath("/app/trips");
  if (tripId) {
    revalidatePath(`/app/trip/${tripId}`);
    return actionSuccess(
      "Trip ready — opening your plan.",
      `/app/trip/${encodeURIComponent(tripId)}?welcome=1&from=recommendation&master=${encodeURIComponent(masterId)}`,
    );
  }
  return actionSuccess(
    "Trip saved.",
    `/app/master-trip/${encodeURIComponent(masterId)}`,
  );
}

export async function updateMasterTripSectionAction(formData: FormData): Promise<FormActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError("Sign in to continue.");
  const { supabase, user } = ctx;
  const masterId = String(formData.get("masterId") ?? "").trim();
  const expectedVersion = Number(formData.get("expectedVersion"));
  const section = String(formData.get("section") ?? "").trim();

  if (!masterId) return actionError("Missing plan id.");

  const row = await loadOwnedMasterFile(supabase, masterId, user.id);
  if (!row) return actionError("Plan not found.");

  if (expectedVersion !== row.version) {
    return actionError("This plan was updated elsewhere. Refresh and try again.");
  }

  let nextFile: MasterTripFile = row.file;

  if (section === "itinerary") {
    let days: MasterItineraryDay[];
    try {
      days = JSON.parse(String(formData.get("itinerary") ?? "[]"));
    } catch {
      return actionError("Invalid itinerary data.");
    }
    nextFile = touchMasterTripFile(
      { ...row.file, itinerary: days },
      { section: "itinerary", summary: "Updated itinerary" },
    );
  } else if (section === "whyItFits") {
    const lines = String(formData.get("whyItFits") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    nextFile = touchMasterTripFile(
      {
        ...row.file,
        recommendation: { ...row.file.recommendation, whyItFits: lines },
      },
      { section: "whyItFits", summary: "Updated why this fits" },
    );
  } else if (section === "practical") {
    nextFile = touchMasterTripFile(
      {
        ...row.file,
        practical: {
          travelEffort: String(formData.get("travelEffort") ?? row.file.practical.travelEffort),
          budgetEstimate: String(formData.get("budgetEstimate") ?? row.file.practical.budgetEstimate),
          timeFit: String(formData.get("timeFit") ?? row.file.practical.timeFit ?? ""),
          practicality: String(formData.get("practicality") ?? row.file.practical.practicality ?? ""),
        },
      },
      { section: "practical", summary: "Updated practical snapshot" },
    );
  } else {
    return actionError("Unknown section.");
  }

  const nextVersion = row.version + 1;
  const { error } = await supabase
    .from("trip_master_files")
    .update({ data: nextFile, version: nextVersion, updated_at: new Date().toISOString() })
    .eq("id", masterId)
    .eq("version", row.version);

  if (error) {
    return actionError("Could not save changes. Refresh and try again.");
  }

  revalidatePath(`/app/master-trip/${masterId}`);
  return actionSuccess("Saved.");
}

export async function refineMasterTripAction(formData: FormData): Promise<FormActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError("Sign in to continue.");
  const { supabase, user } = ctx;
  const masterId = String(formData.get("masterId") ?? "").trim();
  const expectedVersion = Number(formData.get("expectedVersion"));

  const row = await loadOwnedMasterFile(supabase, masterId, user.id);
  if (!row) return actionError("Plan not found.");
  if (expectedVersion !== row.version) {
    return actionError("Plan was updated elsewhere. Refresh and try again.");
  }

  const prefs = row.file.preferences;
  const req: HomepageDecisionRequest = {
    days: prefs.days,
    durationPreset: prefs.durationPreset ?? "custom",
    priorities: prefs.priorities,
    budget: prefs.budget,
    originCity: prefs.originCity,
    destination: row.file.destination.name,
    travelMonth: prefs.travelMonth,
  };

  const engineResult = decideFromHomepageRequest({
    ...req,
    destination: undefined,
  });
  const decision = engineResultToHomepagePayload(engineResult);

  let nextFile = mergeDecisionIntoFile(row.file, decision);
  nextFile = addRefinementEntry(nextFile, "Re-ran recommendation engine", prefs);

  const nextVersion = row.version + 1;
  const { error } = await supabase
    .from("trip_master_files")
    .update({ data: nextFile, version: nextVersion, updated_at: new Date().toISOString() })
    .eq("id", masterId)
    .eq("version", row.version);

  if (error) return actionError("Refinement failed. Try again.");

  revalidatePath(`/app/master-trip/${masterId}`);
  return actionSuccess("Plan refined.");
}
