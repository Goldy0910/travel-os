/**
 * Centralized user-location types for Travel Till 99.
 * Coordinates stay internal — never surface lat/lng in chat UI or AI replies.
 */

export type LocationSource = "gps" | "manual" | "profile";

/** User's remembered location choice for the permission dialog. */
export type LocationPermissionChoice =
  | "unknown"
  | "granted"
  | "denied"
  | "dismissed";

/**
 * Stored user location. Prefer city/state/country for AI and UI;
 * lat/lng are for maps, nearby search, and significant-change detection only.
 */
export type UserLocation = {
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  country: string | null;
  lastUpdated: string;
  source: LocationSource;
  /** When false, location is stored but not sent to AI / auto-refreshed. */
  enabled: boolean;
};

/** Safe subset for AI prompts — no coordinates. */
export type UserLocationPromptContext = {
  city: string | null;
  state: string | null;
  country: string | null;
};

export type ReverseGeocodeResult = {
  city: string | null;
  state: string | null;
  country: string | null;
  displayName: string | null;
};

export type LocationServiceSnapshot = {
  location: UserLocation | null;
  permission: LocationPermissionChoice;
  /** True while GPS / reverse-geocode is in flight. */
  busy: boolean;
  error: string | null;
};

export function isUserLocation(value: unknown): value is UserLocation {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<UserLocation>;
  return (
    typeof v.latitude === "number" &&
    Number.isFinite(v.latitude) &&
    typeof v.longitude === "number" &&
    Number.isFinite(v.longitude) &&
    typeof v.lastUpdated === "string" &&
    (v.source === "gps" || v.source === "manual" || v.source === "profile") &&
    typeof v.enabled === "boolean"
  );
}

export function toPromptContext(
  location: UserLocation | null | undefined,
): UserLocationPromptContext | null {
  if (!location || !location.enabled) return null;
  const city = location.city?.trim() || null;
  const state = location.state?.trim() || null;
  const country = location.country?.trim() || null;
  if (!city && !state && !country) return null;
  return { city, state, country };
}

export function formatLocationLabel(location: UserLocation | null): string {
  if (!location) return "Not set";
  const parts = [location.city, location.state, location.country].filter(
    (p): p is string => Boolean(p?.trim()),
  );
  return parts.length ? parts.join(", ") : "Coordinates saved (city unknown)";
}
