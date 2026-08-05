import { buildTripDraftFromMemory } from "@/lib/chat/create-trip-from-conversation";
import { loadConversationMemory } from "@/lib/chat/memory";
import { ensureTripConversation } from "@/lib/chat/trip-conversation";
import { getFallbackTravelPlaceBySlug } from "@/app/app/create-trip/travel-places-fallback";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { resolveTopLevelDestination } from "@/lib/destination-interest/resolve";
import { createDestinationInterestService } from "@/lib/destination-interest/server";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

type Body = {
  conversationId?: unknown;
  location?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  budget?: unknown;
  travelers?: unknown;
};

/**
 * Create a trip from standalone chat conversation memory.
 * Does not modify /app/create-trip — both paths remain valid.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  if (!conversationId) {
    return Response.json({ ok: false, error: "conversationId is required" }, { status: 400 });
  }

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, title, trip_id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (convError && !/trip_id|schema cache|PGRST|column/i.test(convError.message)) {
    return Response.json({ ok: false, error: convError.message }, { status: 500 });
  }
  if (!conversation && convError && /trip_id|schema cache|PGRST|column/i.test(convError.message)) {
    const fallback = await supabase
      .from("conversations")
      .select("id, title")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (fallback.error) {
      return Response.json({ ok: false, error: fallback.error.message }, { status: 500 });
    }
    if (!fallback.data) {
      return Response.json({ ok: false, error: "Conversation not found" }, { status: 404 });
    }
  } else if (!conversation) {
    return Response.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  if (
    conversation &&
    "trip_id" in conversation &&
    typeof conversation.trip_id === "string" &&
    conversation.trip_id.trim()
  ) {
    return Response.json(
      {
        ok: false,
        error: "This conversation already belongs to a trip",
        tripId: conversation.trip_id,
      },
      { status: 409 },
    );
  }

  const memory = await loadConversationMemory(supabase, conversationId);
  const built = buildTripDraftFromMemory(memory, {
    location: typeof body.location === "string" ? body.location : undefined,
    startDate: typeof body.startDate === "string" ? body.startDate : undefined,
    endDate: typeof body.endDate === "string" ? body.endDate : undefined,
    budget: typeof body.budget === "string" ? body.budget : undefined,
    travelers: typeof body.travelers === "string" ? body.travelers : undefined,
  });

  if (!built.ok) {
    return Response.json({ ok: false, error: built.error }, { status: 400 });
  }

  const draft = built.draft;

  // Prefer curated travel_places canonical location when slug is known.
  let location = draft.location;
  if (draft.travelPlaceSlug) {
    const { data: travelPlace } = await supabase
      .from("travel_places")
      .select("canonical_location")
      .eq("slug", draft.travelPlaceSlug)
      .maybeSingle();
    const fromDb = travelPlace?.canonical_location
      ? String(travelPlace.canonical_location).trim()
      : "";
    const fromFallback =
      getFallbackTravelPlaceBySlug(draft.travelPlaceSlug)?.canonical_location.trim() ?? "";
    location = fromDb || fromFallback || location;
  }

  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    location,
    start_date: draft.startDate,
    end_date: draft.endDate,
    title: location,
    itinerary_setup_complete: false,
    conversation_id: conversationId,
    chat_budget: draft.budget,
    chat_travelers: draft.travelers,
  };

  const { data: newTrip, error: insertError } = await supabase
    .from("trips")
    .insert(insertPayload)
    .select("id")
    .single();

  // If migration not applied yet, retry without chat columns.
  if (insertError && /conversation_id|chat_budget|chat_travelers|schema cache|PGRST/i.test(insertError.message)) {
    const { data: fallbackTrip, error: fallbackError } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        location,
        start_date: draft.startDate,
        end_date: draft.endDate,
        title: location,
        itinerary_setup_complete: false,
      })
      .select("id")
      .single();

    if (fallbackError || !fallbackTrip?.id) {
      return Response.json(
        { ok: false, error: fallbackError?.message || insertError.message || "Could not create trip" },
        { status: 500 },
      );
    }

    const tripId = String(fallbackTrip.id);
    const memberOk = await insertOrganizer(supabase, tripId, user);
    if (!memberOk.ok) {
      await supabase.from("trips").delete().eq("id", tripId);
      return Response.json({ ok: false, error: memberOk.error }, { status: 500 });
    }

    const linked = await ensureTripConversation(supabase, {
      tripId,
      userId: user.id,
      attachConversationId: conversationId,
      title: location,
    });

    void trackTripAddInterest(location, draft.travelPlaceSlug, user.id);
    return Response.json({
      ok: true,
      tripId,
      redirectTo: `/app/trip/${encodeURIComponent(tripId)}?tab=itinerary&setupItinerary=1`,
      linkedConversation: linked.ok,
      draft,
      warning: linked.ok
        ? undefined
        : "Trip created, but conversation link columns may be missing. Run migrations 20260512 and 20260513.",
    });
  }

  if (insertError || !newTrip?.id) {
    return Response.json(
      { ok: false, error: insertError?.message || "Could not create trip" },
      { status: 500 },
    );
  }

  const tripId = String(newTrip.id);
  const memberOk = await insertOrganizer(supabase, tripId, user);
  if (!memberOk.ok) {
    await supabase.from("trips").delete().eq("id", tripId);
    return Response.json({ ok: false, error: memberOk.error }, { status: 500 });
  }

  // Move this conversation into the trip (preserves message history).
  const linked = await ensureTripConversation(supabase, {
    tripId,
    userId: user.id,
    attachConversationId: conversationId,
    title: location,
  });

  void trackTripAddInterest(location, draft.travelPlaceSlug, user.id);
  return Response.json({
    ok: true,
    tripId,
    redirectTo: `/app/trip/${encodeURIComponent(tripId)}?tab=itinerary&setupItinerary=1`,
    linkedConversation: linked.ok,
    draft,
    warnings: draft.warnings,
  });
}

async function trackTripAddInterest(
  location: string,
  travelPlaceSlug: string | null | undefined,
  userId: string,
) {
  try {
    const resolved =
      (travelPlaceSlug
        ? resolveTopLevelDestination({ name: travelPlaceSlug, type: "city" })
        : null) ?? resolveTopLevelDestination({ name: location, type: "city" });
    if (!resolved) return;
    const service = await createDestinationInterestService();
    await service.trackTripAdd(resolved.id, userId);
  } catch {
    // Analytics must never block trip creation.
  }
}

async function insertOrganizer(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tripId: string,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const organizerName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    (user.email?.split("@")[0] ?? "Organizer");

  const { error } = await supabase.from("members").insert({
    trip_id: tripId,
    user_id: user.id,
    name: organizerName,
    email: user.email ?? "",
    role: "organizer",
  });

  if (error) return { ok: false, error: error.message || "Could not set up trip membership." };
  return { ok: true };
}

/** Preview draft from memory without creating a trip. */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId")?.trim() || "";
  if (!conversationId) {
    return Response.json({ ok: false, error: "conversationId is required" }, { status: 400 });
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!conversation) {
    return Response.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  const memory = await loadConversationMemory(supabase, conversationId);
  const built = buildTripDraftFromMemory(memory);
  if (!built.ok) {
    return Response.json({ ok: false, error: built.error, memory }, { status: 400 });
  }
  return Response.json({ ok: true, draft: built.draft, memory });
}
