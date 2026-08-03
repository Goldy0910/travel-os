/**
 * API key for Places API (New) server-side calls (search, photo media).
 * Prefer dedicated server keys (IP or unrestricted). Avoid HTTP-referrer-only browser keys.
 */
export function getGooglePlacesServerKey(): string | null {
  const candidates = [
    process.env.GOOGLE_PLACES_API_KEY,
    process.env.GOOGLE_MAPS_API_KEY,
    // Public keys last — often referrer-locked and blocked for places.googleapis.com
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  ];
  for (const raw of candidates) {
    const k = raw?.trim();
    if (k) return k;
  }
  return null;
}

export function hasGooglePlacesServerKey(): boolean {
  return Boolean(getGooglePlacesServerKey());
}
