/**
 * Normalize a Google Places (New) place id for path use.
 * Accepts either `ChIJ…` or resource name `places/ChIJ…`.
 */
export function normalizeGooglePlaceId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("places/")) {
    const rest = trimmed.slice("places/".length).split("/")[0] ?? "";
    return rest.trim();
  }
  return trimmed;
}

/** True when a photo resource name looks like Places API (New) `places/…/photos/…`. */
export function isPlacesPhotoResourceName(name: string): boolean {
  return /^places\/[^/]+\/photos\/.+$/.test(name.trim());
}
