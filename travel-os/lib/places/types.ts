/**
 * Chat place-card types (Google Places enrichment).
 * Isolated from trip itinerary / activity PlaceInfo to avoid coupling.
 */

export type ExtractedPlace = {
  name: string;
  type: string;
  confidence: number;
};

export type ChatPlaceCard = {
  placeId: string;
  name: string;
  photoName: string | null;
  /** Proxied app URL — never expose raw Google media URLs with keys. */
  photoUrl: string;
  rating: number | null;
  userRatingCount: number;
  category: string;
  address: string;
  openNow: boolean | null;
  mapsUrl: string;
  priceLevel: string;
  summary: string;
  lat: number | null;
  lng: number | null;
  websiteUrl: string;
  phone: string;
};

export type EnrichedPlaceDetails = ChatPlaceCard & {
  openingHours: string[];
  reviews: Array<{
    rating: number | null;
    text: string;
    author: string;
    relativeTime: string;
  }>;
  photos: string[];
  types: string[];
};
