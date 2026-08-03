import { NextRequest, NextResponse } from "next/server";

import { normalizeGooglePlaceId } from "@/lib/google-places-ids";
import { GoogleMapsService } from "@/lib/places/google-maps-service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ placeId: string }>;
};

/**
 * GET /api/places/[placeId]
 * Place details for the chat details drawer (Places API New, cached).
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { placeId: raw } = await params;
  const placeId = normalizeGooglePlaceId(decodeURIComponent(raw || ""));
  if (!placeId) {
    return NextResponse.json({ ok: false, error: "Missing place id" }, { status: 400 });
  }

  if (!GoogleMapsService.hasKey()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Google Places is unavailable. Enable Places API (New) for GOOGLE_PLACES_API_KEY. Chat still works.",
      },
      { status: 503 },
    );
  }

  const details = await GoogleMapsService.getPlaceDetails(placeId);
  if (!details) {
    return NextResponse.json(
      { ok: false, error: "Place details could not be loaded from Google Places." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, place: details });
}
