import { NextRequest, NextResponse } from "next/server";
import { getGooglePlacesServerKey } from "@/lib/google-places-server-key";

type PlacesResp = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    currentOpeningHours?: { openNow?: boolean };
  }>;
};

export async function POST(req: NextRequest) {
  const key = getGooglePlacesServerKey();
  if (!key) {
    return NextResponse.json({ error: "Google Places key missing", places: [] }, { status: 503 });
  }

  let body: { destination?: string; kind?: "atm" | "exchange" };
  try {
    body = (await req.json()) as { destination?: string; kind?: "atm" | "exchange" };
  } catch {
    return NextResponse.json({ error: "Invalid JSON", places: [] }, { status: 400 });
  }

  const destination = (body.destination ?? "").trim();
  const kind = body.kind === "atm" ? "atm" : "exchange";
  if (!destination) {
    return NextResponse.json({ error: "destination is required", places: [] }, { status: 400 });
  }

  const textQuery = kind === "atm" ? `ATM near ${destination}` : `Currency exchange near ${destination}`;

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.rating,places.userRatingCount,places.currentOpeningHours",
      },
      body: JSON.stringify({
        textQuery,
        pageSize: 10,
        languageCode: "en",
      }),
    });
    const data = (await response.json()) as PlacesResp;
    if (!response.ok) {
      return NextResponse.json({ error: "Places search failed", places: [] }, { status: 502 });
    }

    const places = (data.places ?? []).map((place) => ({
      id: place.id ?? "",
      name: place.displayName?.text ?? "Unknown",
      address: place.formattedAddress ?? "",
      mapsUrl: place.googleMapsUri ?? "",
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? 0,
      openNow: place.currentOpeningHours?.openNow ?? null,
    }));
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ error: "Could not load places", places: [] }, { status: 500 });
  }
}
