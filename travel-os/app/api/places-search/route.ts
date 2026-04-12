import { NextRequest, NextResponse } from "next/server";

import { getGooglePlacesServerKey } from "@/lib/google-places-server-key";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

function jsonResponse(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: NO_STORE,
  });
}

/**
 * Restaurant text search uses only Places API (New):
 * POST https://places.googleapis.com/v1/places:searchText
 * We do not call legacy maps.googleapis.com/maps/api/place/textsearch/json.
 */

const NEW_API_FIELD_MASK_FULL =
  "places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.googleMapsUri,places.types,places.userRatingCount,places.photos,places.currentOpeningHours,places.editorialSummary";

const NEW_API_FIELD_MASK_MIN =
  "places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.googleMapsUri,places.types,places.userRatingCount,places.photos";

function newApiErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const err = (data as { error?: { message?: string; status?: string } }).error;
  if (err && typeof err.message === "string" && err.message.trim()) return err.message.trim();
  if (err && typeof err.status === "string" && err.status.trim()) return err.status.trim();
  return "";
}

type NormalizedPlace = {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  user_rating_count: number;
  price_level: string | null;
  summary: string;
  maps_url: string;
  is_open: boolean | null;
  photo_name: string | null;
  photo_legacy_ref: string | null;
  types: string[];
};

function mapNewPlaces(data: unknown): NormalizedPlace[] {
  const root = data as { places?: unknown[] };
  const rawPlaces = Array.isArray(root.places) ? root.places : [];
  return rawPlaces.map((p: unknown) => {
    const x = p as {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      rating?: number;
      userRatingCount?: number;
      priceLevel?: string;
      editorialSummary?: { text?: string };
      googleMapsUri?: string;
      currentOpeningHours?: { openNow?: boolean };
      photos?: Array<{ name?: string; googleMapsUri?: string }>;
      types?: string[];
    };
    const firstPhoto = x.photos?.[0];
    const photoName =
      typeof firstPhoto?.name === "string" && firstPhoto.name.startsWith("places/")
        ? firstPhoto.name
        : null;
    return {
      place_id: x.id ?? "",
      name: x.displayName?.text ?? "",
      address: x.formattedAddress ?? "",
      rating: x.rating ?? null,
      user_rating_count: x.userRatingCount ?? 0,
      price_level: x.priceLevel ?? null,
      summary: x.editorialSummary?.text ?? "",
      maps_url: x.googleMapsUri ?? "",
      is_open: x.currentOpeningHours?.openNow ?? null,
      photo_name: photoName,
      photo_legacy_ref: null,
      types: x.types ?? [],
    };
  });
}

async function searchPlacesNewOnce(
  key: string,
  fieldMask: string,
  requestBody: Record<string, unknown>,
): Promise<{ ok: true; places: NormalizedPlace[] } | { ok: false; message: string; raw?: unknown }> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(requestBody),
  });

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, message: newApiErrorMessage(data) || `HTTP ${response.status}`, raw: data };
  }
  return { ok: true, places: mapNewPlaces(data) };
}

async function searchPlacesNew(
  key: string,
  textQuery: string,
  budget: string,
  lat?: number,
  lon?: number,
): Promise<{ ok: true; places: NormalizedPlace[] } | { ok: false; message: string; raw?: unknown }> {
  const requestBody: Record<string, unknown> = {
    textQuery,
    pageSize: 20,
    languageCode: "en",
  };

  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    requestBody.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lon },
        radius: 5000.0,
      },
    };
  }

  if (budget) {
    const priceMap: Record<string, number[]> = {
      budget: [1],
      mid: [2],
      upscale: [3, 4],
    };
    const levels = priceMap[budget];
    if (levels) {
      const labels = ["FREE", "INEXPENSIVE", "MODERATE", "EXPENSIVE", "VERY_EXPENSIVE"];
      requestBody.priceLevels = levels.map((n) => `PRICE_LEVEL_${labels[n]}`);
    }
  }

  let attempt = await searchPlacesNewOnce(key, NEW_API_FIELD_MASK_FULL, { ...requestBody });
  if (attempt.ok) return attempt;

  let msg = attempt.message.toLowerCase();
  if (
    msg.includes("field") ||
    msg.includes("invalid") ||
    msg.includes("fieldmask") ||
    msg.includes("unknown name")
  ) {
    attempt = await searchPlacesNewOnce(key, NEW_API_FIELD_MASK_MIN, { ...requestBody });
    if (attempt.ok) return attempt;
    msg = attempt.message.toLowerCase();
  }

  if (budget && (msg.includes("price") || msg.includes("invalid_argument"))) {
    const noPrice = { ...requestBody };
    delete noPrice.priceLevels;
    attempt = await searchPlacesNewOnce(key, NEW_API_FIELD_MASK_MIN, noPrice);
    if (attempt.ok) return attempt;
  }

  return attempt;
}

export async function POST(req: NextRequest) {
  const key = getGooglePlacesServerKey();
  if (!key) {
    return jsonResponse(
      {
        error:
          "No Google Places server API key. Set GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY (recommended: IP-restricted or unrestricted for this host). Places API (New) is called only from /api/places-search.",
        hint:
          "Optional: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is only for map/photo URLs in the browser—not for this route if your key is referrer-locked.",
        places: [],
      },
      { status: 503 },
    );
  }

  let body: {
    destination?: string;
    cuisine?: string;
    budget?: string;
    dietary?: string;
    latitude?: number;
    longitude?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON", places: [] }, { status: 400 });
  }

  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  if (!destination) {
    return jsonResponse({ error: "destination is required", places: [] }, { status: 400 });
  }

  const cuisine = typeof body.cuisine === "string" ? body.cuisine.trim() : "";
  const dietary = typeof body.dietary === "string" ? body.dietary.trim() : "";
  const budget = typeof body.budget === "string" ? body.budget.trim() : "";

  const textQuery = [cuisine || "restaurant", dietary, "in", destination].filter(Boolean).join(" ");

  const lat =
    typeof body.latitude === "number" && Number.isFinite(body.latitude) ? body.latitude : undefined;
  const lon =
    typeof body.longitude === "number" && Number.isFinite(body.longitude) ? body.longitude : undefined;

  const newResult = await searchPlacesNew(key, textQuery, budget, lat, lon);

  if (newResult.ok) {
    return jsonResponse({ places: newResult.places, source: "places_new" as const });
  }

  const blocked =
    newResult.message.toLowerCase().includes("blocked") ||
    newResult.message.toLowerCase().includes("not authorized");
  const hint = blocked
    ? "This route only calls Places API (New) (places.googleapis.com). Use GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY with IP or no application restriction—not HTTP referrers only."
    : newResult.message.includes("PERMISSION_DENIED") || newResult.message.includes("API key not valid")
      ? "Enable billing and enable “Places API (New)” for your project. Use a server key (IP or unrestricted)."
      : newResult.message.includes("FieldMask") || newResult.message.includes("field")
        ? "Places API (New) rejected the request. Confirm Places API (New) is enabled and the field mask is valid."
        : undefined;

  return jsonResponse(
    {
      error: `Places search failed: ${newResult.message || "unknown"}`,
      hint,
      places: [],
      ...(process.env.NODE_ENV === "development" ? { detail: newResult.raw } : {}),
    },
    { status: 502 },
  );
}
