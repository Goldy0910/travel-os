import "server-only";

import { unstable_cache } from "next/cache";
import { normalizeGooglePlaceId } from "@/lib/google-places-ids";
import { getGooglePlacesServerKey } from "@/lib/google-places-server-key";
import type { ChatPlaceCard, EnrichedPlaceDetails } from "@/lib/places/types";

/** Chat place enrichment cache — 24h (spec). Separate keys from activity 7d cache. */
const REVALIDATE_SEC = 60 * 60 * 24;
const PHOTO_PROXY_HEIGHT = 360;

function priceLevelLabel(levelRaw: string): string {
  const level = levelRaw.replace("PRICE_LEVEL_", "").toUpperCase();
  if (level === "FREE") return "Free";
  if (level === "INEXPENSIVE") return "Budget-friendly";
  if (level === "MODERATE") return "Moderate";
  if (level === "EXPENSIVE") return "Expensive";
  if (level === "VERY_EXPENSIVE") return "Premium";
  return "";
}

function categoryFromTypes(input: {
  primaryTypeDisplayName?: { text?: string };
  primaryType?: string;
  types?: string[];
}): string {
  const display = input.primaryTypeDisplayName?.text?.trim();
  if (display) return display;
  const primary = input.primaryType?.replace(/_/g, " ").trim();
  if (primary) return primary.replace(/\b\w/g, (c) => c.toUpperCase());
  const first = input.types?.find((t) => t && t !== "point_of_interest" && t !== "establishment");
  if (first) return first.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return "Place";
}

function buildPhotoUrl(photoName: string | null): string {
  if (!photoName) return "";
  return `/api/place-photo?name=${encodeURIComponent(photoName)}&maxH=${PHOTO_PROXY_HEIGHT}`;
}

type PlacesDetailsPayload = {
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
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  location?: { latitude?: number; longitude?: number };
  photos?: Array<{ name?: string }>;
  reviews?: Array<{
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    authorAttribution?: { displayName?: string };
    relativePublishTimeDescription?: string;
  }>;
};

function toCard(data: PlacesDetailsPayload): ChatPlaceCard | null {
  const placeId = normalizeGooglePlaceId(data.id ?? "");
  const name = data.displayName?.text?.trim() ?? "";
  if (!placeId || !name) return null;

  const photos = (data.photos ?? [])
    .map((p) => (typeof p.name === "string" && p.name.startsWith("places/") ? p.name : ""))
    .filter(Boolean);
  const photoName = photos[0] ?? null;

  return {
    placeId,
    name,
    photoName,
    photoUrl: buildPhotoUrl(photoName),
    rating: typeof data.rating === "number" ? data.rating : null,
    userRatingCount: typeof data.userRatingCount === "number" ? data.userRatingCount : 0,
    category: categoryFromTypes(data),
    address: data.formattedAddress || "",
    openNow:
      typeof data.currentOpeningHours?.openNow === "boolean"
        ? data.currentOpeningHours.openNow
        : null,
    mapsUrl: data.googleMapsUri || "",
    priceLevel: priceLevelLabel(data.priceLevel || ""),
    summary: data.editorialSummary?.text || "",
    lat: typeof data.location?.latitude === "number" ? data.location.latitude : null,
    lng: typeof data.location?.longitude === "number" ? data.location.longitude : null,
    websiteUrl: data.websiteUri || "",
    phone: data.nationalPhoneNumber || "",
  };
}

function toDetails(data: PlacesDetailsPayload): EnrichedPlaceDetails | null {
  const card = toCard(data);
  if (!card) return null;

  const photos = (data.photos ?? [])
    .map((p) => (typeof p.name === "string" && p.name.startsWith("places/") ? p.name : ""))
    .filter(Boolean)
    .slice(0, 8);

  const reviews = (data.reviews ?? []).slice(0, 5).map((r) => ({
    rating: typeof r.rating === "number" ? r.rating : null,
    text: r.text?.text || r.originalText?.text || "",
    author: r.authorAttribution?.displayName || "Traveler",
    relativeTime: r.relativePublishTimeDescription || "",
  }));

  const openingHours =
    data.currentOpeningHours?.weekdayDescriptions ??
    data.regularOpeningHours?.weekdayDescriptions ??
    [];

  return {
    ...card,
    photos,
    reviews,
    openingHours,
    types: Array.isArray(data.types) ? data.types.filter((t): t is string => typeof t === "string") : [],
  };
}

class GoogleMapsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleMapsServiceError";
  }
}

/**
 * Google Places API (New) wrapper for chat place cards / details.
 * Temporary cache only (Next unstable_cache, 24h) — no permanent Google content duplication.
 */
export class GoogleMapsService {
  static hasKey(): boolean {
    return Boolean(getGooglePlacesServerKey());
  }

  static async searchPlaceId(query: string): Promise<string> {
    const q = query.trim();
    if (!q) return "";
    try {
      return await unstable_cache(
        async () => {
          const key = getGooglePlacesServerKey();
          if (!key) throw new GoogleMapsServiceError("Missing Places API key");
          const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": key,
              "X-Goog-FieldMask": "places.id",
            },
            body: JSON.stringify({
              textQuery: q,
              pageSize: 1,
              languageCode: "en",
            }),
            cache: "no-store",
          });
          if (!response.ok) {
            throw new GoogleMapsServiceError(`searchText HTTP ${response.status}`);
          }
          const data = (await response.json().catch(() => null)) as {
            places?: Array<{ id?: string }>;
          } | null;
          return normalizeGooglePlaceId(data?.places?.[0]?.id ?? "");
        },
        ["travel-os-chat-place-search-v1", q.toLowerCase()],
        { revalidate: REVALIDATE_SEC },
      )();
    } catch {
      return "";
    }
  }

  static async getPlaceDetails(placeId: string): Promise<EnrichedPlaceDetails | null> {
    const id = normalizeGooglePlaceId(placeId);
    if (!id) return null;
    try {
      return await unstable_cache(
        async () => {
          const key = getGooglePlacesServerKey();
          if (!key) throw new GoogleMapsServiceError("Missing Places API key");
          const fields =
            "id,displayName,formattedAddress,googleMapsUri,rating,userRatingCount,priceLevel,editorialSummary,websiteUri,nationalPhoneNumber,currentOpeningHours,regularOpeningHours,photos,reviews,location,primaryType,primaryTypeDisplayName,types";
          const response = await fetch(
            `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
            {
              method: "GET",
              headers: {
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": fields,
              },
              cache: "no-store",
            },
          );
          if (!response.ok) {
            throw new GoogleMapsServiceError(`placeDetails HTTP ${response.status}`);
          }
          const data = (await response.json().catch(() => null)) as PlacesDetailsPayload | null;
          const details = data ? toDetails(data) : null;
          if (!details) throw new GoogleMapsServiceError("Empty place details");
          return details;
        },
        ["travel-os-chat-place-details-v1", id],
        { revalidate: REVALIDATE_SEC },
      )();
    } catch {
      return null;
    }
  }

  static async getPlaceCard(placeId: string): Promise<ChatPlaceCard | null> {
    const details = await this.getPlaceDetails(placeId);
    if (!details) return null;
    return {
      placeId: details.placeId,
      name: details.name,
      photoName: details.photoName,
      photoUrl: details.photoUrl,
      rating: details.rating,
      userRatingCount: details.userRatingCount,
      category: details.category,
      address: details.address,
      openNow: details.openNow,
      mapsUrl: details.mapsUrl,
      priceLevel: details.priceLevel,
      summary: details.summary,
      lat: details.lat,
      lng: details.lng,
      websiteUrl: details.websiteUrl,
      phone: details.phone,
    };
  }

  static async searchNearby(query: string, limit = 5): Promise<ChatPlaceCard[]> {
    const q = query.trim();
    if (!q) return [];
    try {
      return await unstable_cache(
        async () => {
          const key = getGooglePlacesServerKey();
          if (!key) throw new GoogleMapsServiceError("Missing Places API key");
          const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": key,
              "X-Goog-FieldMask":
                "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.photos,places.primaryTypeDisplayName,places.types,places.currentOpeningHours,places.priceLevel,places.location,places.editorialSummary,places.websiteUri,places.nationalPhoneNumber",
            },
            body: JSON.stringify({
              textQuery: q,
              pageSize: Math.min(8, Math.max(1, limit)),
              languageCode: "en",
            }),
            cache: "no-store",
          });
          if (!response.ok) {
            throw new GoogleMapsServiceError(`nearby HTTP ${response.status}`);
          }
          const data = (await response.json().catch(() => null)) as {
            places?: PlacesDetailsPayload[];
          } | null;
          const cards: ChatPlaceCard[] = [];
          for (const place of data?.places ?? []) {
            const card = toCard(place);
            if (card) cards.push(card);
          }
          if (!cards.length) throw new GoogleMapsServiceError("No nearby places");
          return cards;
        },
        ["travel-os-chat-place-nearby-v1", q.toLowerCase(), String(limit)],
        { revalidate: REVALIDATE_SEC },
      )();
    } catch {
      return [];
    }
  }
}

export { buildPhotoUrl };
