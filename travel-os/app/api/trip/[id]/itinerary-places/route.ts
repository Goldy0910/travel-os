import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { GoogleMapsService } from "@/lib/places/google-maps-service";
import type { ChatPlaceCard } from "@/lib/places/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type ItineraryItemRow = {
  id: string;
  activity_name: string | null;
  title: string | null;
  location: string | null;
  google_place_id?: string | null;
};

/** Cap concurrent Google Places lookups per request so a big itinerary can't stall the tab. */
const MAX_ITEMS = 60;

/**
 * GET /api/trip/[id]/itinerary-places
 * Resolves each itinerary activity to a Google place card (name, photo, lat/lng) so the
 * itinerary tab can plot pins on a map and open the same details drawer used in chat.
 * Results are cached upstream by GoogleMapsService, so repeat calls are cheap.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { id: tripId } = await params;
  if (!tripId) {
    return NextResponse.json({ ok: false, error: "Missing trip id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const member = await isTripMember(supabase, tripId, user.id);
  if (!member) {
    return NextResponse.json({ ok: false, error: "Not a trip member" }, { status: 403 });
  }

  if (!GoogleMapsService.hasKey()) {
    return NextResponse.json({ ok: true, places: {} });
  }

  const { data, error } = await supabase
    .from("itinerary_items")
    .select("id, activity_name, title, location, google_place_id")
    .eq("trip_id", tripId)
    .limit(MAX_ITEMS);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const items = (data ?? []) as ItineraryItemRow[];
  const places: Record<string, ChatPlaceCard> = {};

  await Promise.all(
    items.map(async (item) => {
      const name = (item.activity_name || item.title || "").trim();
      const location = (item.location || "").trim();
      if (!name && !location) return;

      const storedPlaceId = (item.google_place_id || "").trim();
      const query = [name, location].filter(Boolean).join(", ");
      const placeId = storedPlaceId || (await GoogleMapsService.searchPlaceId(query));
      if (!placeId) return;

      const card = await GoogleMapsService.getPlaceCard(placeId);
      if (card) places[item.id] = card;
    }),
  );

  return NextResponse.json({ ok: true, places });
}
