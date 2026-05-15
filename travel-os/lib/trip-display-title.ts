/**
 * Trip title for UI — prefer short destination name (e.g. "Goa"), not country alone ("India").
 */
export function resolveTripDisplayTitle(options: {
  storedTitle?: string;
  location?: string;
  destinationName?: string | null;
  fallback?: string;
}): string {
  const preferred = options.destinationName?.trim();
  if (preferred) return preferred;

  const title = (options.storedTitle ?? "").trim();
  const location = (options.location ?? "").trim();
  const fallback = options.fallback ?? "Trip";

  if (location.includes(",")) {
    const city = location.split(",")[0]?.trim() ?? "";
    const country = location.split(",").slice(-1)[0]?.trim().toLowerCase() ?? "";
    const titleLower = title.toLowerCase();
    if (city && (titleLower === country || title === location)) {
      return city;
    }
  }

  if (title) return title;
  if (location) {
    const city = location.split(",")[0]?.trim();
    return city || location;
  }
  return fallback;
}
