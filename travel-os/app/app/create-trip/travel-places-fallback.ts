import type { TravelPlaceDTO } from "@/app/app/create-trip/travel-place-types";

/**
 * Ensures curated destinations appear in create-trip even if a migration has not been applied yet.
 * Database rows override these by slug when present.
 */
export const TRAVEL_PLACES_FALLBACK: TravelPlaceDTO[] = [
  {
    slug: "hyderabad-india",
    primary_label: "Hyderabad",
    subtitle: "Telangana",
    visa_note: null,
    tags: ["City", "Culture", "Food"],
    icon_key: "city",
    sort_order: 41,
    canonical_location: "Hyderabad, India",
  },
];

export function mergeTravelPlacesFromDb(rows: TravelPlaceDTO[]): TravelPlaceDTO[] {
  const bySlug = new Map(rows.map((p) => [p.slug, p]));
  for (const place of TRAVEL_PLACES_FALLBACK) {
    if (!bySlug.has(place.slug)) {
      bySlug.set(place.slug, place);
    }
  }
  return [...bySlug.values()].sort((a, b) => a.sort_order - b.sort_order);
}

/** Used by create-trip server action when `travel_places` row is not migrated yet. */
export function getFallbackTravelPlaceBySlug(slug: string): TravelPlaceDTO | null {
  const trimmed = slug.trim();
  return TRAVEL_PLACES_FALLBACK.find((p) => p.slug === trimmed) ?? null;
}
