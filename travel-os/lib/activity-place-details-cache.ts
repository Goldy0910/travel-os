import "server-only";

import { unstable_cache } from "next/cache";
import { normalizeGooglePlaceId } from "@/lib/google-places-ids";
import { getGooglePlacesServerKey } from "@/lib/google-places-server-key";

/** Search / nearby text cache (7d) — resolves place id from free-text query. */
const REVALIDATE_SEARCH_SEC = 60 * 60 * 24 * 7;
/** Place details cache (7d) — photos, reviews, hours, etc. */
const REVALIDATE_DETAILS_SEC = 60 * 60 * 24 * 7;
/** Nearby list cache (3d) */
const REVALIDATE_NEARBY_SEC = 60 * 60 * 24 * 3;

export type PlaceReview = {
  rating: number | null;
  text: string;
  author: string;
  relativeTime: string;
};

export type PlaceInfo = {
  id: string;
  name: string;
  address: string;
  mapsUrl: string;
  rating: number | null;
  userRatingCount: number;
  priceLevel: string;
  summary: string;
  websiteUrl: string;
  phone: string;
  openNow: boolean | null;
  openingHours: string[];
  photos: string[];
  reviews: PlaceReview[];
};

export type NearbyPlace = {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  userRatingCount: number;
  mapsUrl: string;
};

export type PlacesApiStatus = {
  configured: boolean;
  reachable: boolean;
  message: string | null;
};

class PlacesApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlacesApiError";
  }
}

function normalizeCacheKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 280);
}

function priceLevelLabel(levelRaw: string): string {
  const level = levelRaw.replace("PRICE_LEVEL_", "").toUpperCase();
  if (level === "FREE") return "Free";
  if (level === "INEXPENSIVE") return "Budget-friendly";
  if (level === "MODERATE") return "Moderate";
  if (level === "EXPENSIVE") return "Expensive";
  if (level === "VERY_EXPENSIVE") return "Premium";
  return "Not available";
}

function placesDeniedMessage(status: number, body: string): string {
  if (status === 403 || status === 401) {
    if (/API_KEY_HTTP_REFERRER_BLOCKED|referer/i.test(body)) {
      return "Your Google key is restricted to HTTP referrers. Use a server key (IP restriction or none) for Places API (New).";
    }
    if (/PERMISSION_DENIED|not been used|has not been used|enable/i.test(body)) {
      return "Enable Places API (New) on the Google Cloud project for GOOGLE_PLACES_API_KEY, with billing on.";
    }
    return "Places API (New) denied this key. Enable the API and allow it on GOOGLE_PLACES_API_KEY.";
  }
  return `Places API request failed (HTTP ${status}).`;
}

async function fetchGoogleJson(
  url: string,
  key: string,
  fieldMask: string,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; body: string }> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, status: response.status, body };
  }
  const data = await response.json().catch(() => null);
  return { ok: true, data };
}

async function searchTextPlaceUncached(query: string, apiKey: string): Promise<string> {
  if (!query.trim()) return "";
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 1,
      languageCode: "en",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new PlacesApiError(placesDeniedMessage(response.status, body));
  }
  const data = (await response.json().catch(() => null)) as { places?: Array<{ id?: string }> } | null;
  const placeId = data?.places?.[0]?.id;
  return typeof placeId === "string" ? normalizeGooglePlaceId(placeId) : "";
}

async function fetchPlaceDetailsUncached(placeId: string, apiKey: string): Promise<PlaceInfo> {
  const id = normalizeGooglePlaceId(placeId);
  if (!id) throw new PlacesApiError("Missing place id");

  const fields =
    "id,displayName,formattedAddress,googleMapsUri,rating,userRatingCount,priceLevel,editorialSummary,websiteUri,nationalPhoneNumber,currentOpeningHours,regularOpeningHours,photos,reviews";
  const result = await fetchGoogleJson(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
    apiKey,
    fields,
  );
  if (!result.ok) {
    throw new PlacesApiError(placesDeniedMessage(result.status, result.body));
  }

  const data = result.data as
    | {
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        googleMapsUri?: string;
        rating?: number;
        userRatingCount?: number;
        priceLevel?: string;
        editorialSummary?: { text?: string };
        websiteUri?: string;
        nationalPhoneNumber?: string;
        currentOpeningHours?: { openNow?: boolean };
        regularOpeningHours?: { weekdayDescriptions?: string[] };
        photos?: Array<{ name?: string }>;
        reviews?: Array<{
          rating?: number;
          text?: { text?: string };
          originalText?: { text?: string };
          authorAttribution?: { displayName?: string };
          relativePublishTimeDescription?: string;
        }>;
      }
    | null;
  if (!data?.id) throw new PlacesApiError("Place details response was empty");

  const photos = (data.photos ?? [])
    .map((p) => (typeof p.name === "string" && p.name.startsWith("places/") ? p.name : ""))
    .filter(Boolean)
    .slice(0, 5);

  const reviews: PlaceReview[] = (data.reviews ?? []).slice(0, 3).map((r) => ({
    rating: typeof r.rating === "number" ? r.rating : null,
    text: r.text?.text || r.originalText?.text || "No review text provided.",
    author: r.authorAttribution?.displayName || "Traveler",
    relativeTime: r.relativePublishTimeDescription || "",
  }));

  return {
    id: normalizeGooglePlaceId(data.id) || data.id,
    name: data.displayName?.text || "",
    address: data.formattedAddress || "",
    mapsUrl: data.googleMapsUri || "",
    rating: typeof data.rating === "number" ? data.rating : null,
    userRatingCount: typeof data.userRatingCount === "number" ? data.userRatingCount : 0,
    priceLevel: priceLevelLabel(data.priceLevel || ""),
    summary: data.editorialSummary?.text || "",
    websiteUrl: data.websiteUri || "",
    phone: data.nationalPhoneNumber || "",
    openNow: typeof data.currentOpeningHours?.openNow === "boolean" ? data.currentOpeningHours.openNow : null,
    openingHours: data.regularOpeningHours?.weekdayDescriptions ?? [],
    photos,
    reviews,
  };
}

async function fetchNearbyPlacesUncached(query: string, apiKey: string): Promise<NearbyPlace[]> {
  if (!query.trim()) return [];
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri",
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 5,
      languageCode: "en",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new PlacesApiError(placesDeniedMessage(response.status, body));
  }
  const data = (await response.json().catch(() => null)) as
    | {
        places?: Array<{
          id?: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          rating?: number;
          userRatingCount?: number;
          googleMapsUri?: string;
        }>;
      }
    | null;
  return (data?.places ?? [])
    .map((p) => ({
      id: normalizeGooglePlaceId(p.id ?? "") || (p.id ?? ""),
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
      rating: typeof p.rating === "number" ? p.rating : null,
      userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : 0,
      mapsUrl: p.googleMapsUri ?? "",
    }))
    .filter((p) => p.id && p.name);
}

/**
 * Cached text search → first Google Place id (Places API New).
 * API errors throw inside the cache callback so they are not stored for 7 days.
 */
export async function getCachedSearchPlaceId(query: string): Promise<string> {
  const normalized = normalizeCacheKey(query);
  if (!normalized) return "";
  try {
    return await unstable_cache(
      async () => {
        const apiKey = getGooglePlacesServerKey();
        if (!apiKey) throw new PlacesApiError("Missing Places API key");
        return searchTextPlaceUncached(normalized, apiKey);
      },
      ["travel-os-activity-place-search-v2", normalized],
      { revalidate: REVALIDATE_SEARCH_SEC },
    )();
  } catch {
    return "";
  }
}

/**
 * Cached Place Details (photos, reviews, hours, etc.) by resource id.
 * Failures throw and are not written into the long-lived cache.
 */
export async function getCachedPlaceDetails(placeId: string): Promise<PlaceInfo | null> {
  const id = normalizeGooglePlaceId(placeId);
  if (!id) return null;
  try {
    return await unstable_cache(
      async () => {
        const apiKey = getGooglePlacesServerKey();
        if (!apiKey) throw new PlacesApiError("Missing Places API key");
        return fetchPlaceDetailsUncached(id, apiKey);
      },
      ["travel-os-activity-place-details-v2", id],
      { revalidate: REVALIDATE_DETAILS_SEC },
    )();
  } catch {
    return null;
  }
}

/**
 * Cached nearby text search results.
 * API failures are not cached.
 */
export async function getCachedNearbyPlaces(query: string): Promise<NearbyPlace[]> {
  const normalized = normalizeCacheKey(query);
  if (!normalized) return [];
  try {
    return await unstable_cache(
      async () => {
        const apiKey = getGooglePlacesServerKey();
        if (!apiKey) throw new PlacesApiError("Missing Places API key");
        const places = await fetchNearbyPlacesUncached(normalized, apiKey);
        if (!places.length) throw new PlacesApiError("No nearby places");
        return places;
      },
      ["travel-os-activity-nearby-v2", normalized],
      { revalidate: REVALIDATE_NEARBY_SEC },
    )();
  } catch {
    return [];
  }
}

/**
 * Lightweight probe used by activity UI when place enrichment is empty.
 */
export async function getPlacesApiStatus(): Promise<PlacesApiStatus> {
  const apiKey = getGooglePlacesServerKey();
  if (!apiKey) {
    return {
      configured: false,
      reachable: false,
      message:
        "Missing GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY). Add a server key with Places API (New) enabled.",
    };
  }

  try {
    await searchTextPlaceUncached("Eiffel Tower Paris", apiKey);
    return { configured: true, reachable: true, message: null };
  } catch (err) {
    const message = err instanceof PlacesApiError ? err.message : "Places API (New) is unreachable.";
    return { configured: true, reachable: false, message };
  }
}
