export const DESTINATION_INTEREST_EVENT_TYPES = [
  "SEARCH",
  "AI_RECOMMENDED",
  "DETAIL_VIEW",
  "TRIP_ADD",
  "FAVORITE",
] as const;

export type DestinationInterestEventType = (typeof DESTINATION_INTEREST_EVENT_TYPES)[number];

export const GUEST_ACTOR_COOKIE = "tt99_dest_interest_sid";
export const GUEST_ACTOR_PREFIX = "guest:";

export const DESTINATION_ID_MAX_LEN = 96;
export const ACTOR_ID_MAX_LEN = 128;

/** Ignore identical track posts from the same actor within this window. */
export const DUPLICATE_TRACK_WINDOW_MS = 8_000;

export const INTEREST_READ_CACHE_TTL_MS = 60_000;
export const INTEREST_READ_CACHE_MAX = 400;

export const TOP_LEVEL_ENTITY_TYPES = new Set([
  "city",
  "country",
  "region",
  "island",
  "destination",
  "state",
  "province",
  "town",
]);

export const POI_ENTITY_TYPES = new Set([
  "attraction",
  "landmark",
  "restaurant",
  "cafe",
  "hotel",
  "museum",
  "temple",
  "park",
  "beach",
  "market",
  "airport",
  "activity",
  "national_park",
  "church",
  "neighborhood",
  "area",
]);

export const TOP_LEVEL_GOOGLE_TYPES = new Set([
  "locality",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "country",
  "colloquial_area",
  "archipelago",
]);

export const POI_GOOGLE_TYPES = new Set([
  "tourist_attraction",
  "restaurant",
  "cafe",
  "bar",
  "lodging",
  "hotel",
  "resort_hotel",
  "motel",
  "guest_house",
  "museum",
  "hindu_temple",
  "church",
  "mosque",
  "synagogue",
  "amusement_park",
  "zoo",
  "aquarium",
  "shopping_mall",
  "night_club",
  "meal_takeaway",
  "meal_delivery",
  "food",
  "bakery",
  "campground",
  "rv_park",
]);

export const POI_NAME_HINT =
  /\b(temple|caf[eé]|hotel|restaurant|resort|marriott|hyatt|museum|mall|church|shrine|hostel|pass)\b/i;

export const ACTIVITY_NAME_HINT =
  /\b(rafting|trekking|paragliding|scuba|snorkeling|bungee|zip[\s-]?line)\b/i;
