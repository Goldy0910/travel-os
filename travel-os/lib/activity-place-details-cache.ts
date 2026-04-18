import "server-only";

import { unstable_cache } from "next/cache";
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

async function fetchGoogleJson(url: string, key: string, fieldMask: string): Promise<unknown | null> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
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
  if (!response.ok) return "";
  const data = (await response.json().catch(() => null)) as { places?: Array<{ id?: string }> } | null;
  const placeId = data?.places?.[0]?.id;
  return typeof placeId === "string" ? placeId : "";
}

async function fetchPlaceDetailsUncached(placeId: string, apiKey: string): Promise<PlaceInfo | null> {
  if (!placeId) return null;
  const fields =
    "id,displayName,formattedAddress,googleMapsUri,rating,userRatingCount,priceLevel,editorialSummary,websiteUri,nationalPhoneNumber,currentOpeningHours,regularOpeningHours,photos,reviews";
  const data = (await fetchGoogleJson(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    apiKey,
    fields,
  )) as
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
  if (!data?.id) return null;

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
    id: data.id,
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
  if (!response.ok) return [];
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
      id: p.id ?? "",
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
 * Reduces repeated SearchText billing for the same activity title/location string.
 */
export async function getCachedSearchPlaceId(query: string): Promise<string> {
  const normalized = normalizeCacheKey(query);
  if (!normalized) return "";
  return unstable_cache(
    async () => {
      const apiKey = getGooglePlacesServerKey();
      if (!apiKey) return "";
      return searchTextPlaceUncached(normalized, apiKey);
    },
    ["travel-os-activity-place-search-v1", normalized],
    { revalidate: REVALIDATE_SEARCH_SEC },
  )();
}

/**
 * Cached Place Details (photos, reviews, hours, etc.) by resource id.
 */
export async function getCachedPlaceDetails(placeId: string): Promise<PlaceInfo | null> {
  const id = placeId.trim();
  if (!id) return null;
  return unstable_cache(
    async () => {
      const apiKey = getGooglePlacesServerKey();
      if (!apiKey) return null;
      return fetchPlaceDetailsUncached(id, apiKey);
    },
    ["travel-os-activity-place-details-v1", id],
    { revalidate: REVALIDATE_DETAILS_SEC },
  )();
}

/**
 * Cached nearby text search results.
 */
export async function getCachedNearbyPlaces(query: string): Promise<NearbyPlace[]> {
  const normalized = normalizeCacheKey(query);
  if (!normalized) return [];
  return unstable_cache(
    async () => {
      const apiKey = getGooglePlacesServerKey();
      if (!apiKey) return [];
      return fetchNearbyPlacesUncached(normalized, apiKey);
    },
    ["travel-os-activity-nearby-v1", normalized],
    { revalidate: REVALIDATE_NEARBY_SEC },
  )();
}
