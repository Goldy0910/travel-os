/**
 * API key for Places API (New) server-side calls (search, photo media).
 * Prefer GOOGLE_MAPS_API_KEY / GOOGLE_PLACES_API_KEY (IP or unrestricted).
 */
export function getGooglePlacesServerKey(): string | null {
  const candidates = [
    process.env.GOOGLE_MAPS_API_KEY,
    process.env.GOOGLE_PLACES_API_KEY,
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
  ];
  for (const raw of candidates) {
    const k = raw?.trim();
    if (k) return k;
  }
  return null;
}
