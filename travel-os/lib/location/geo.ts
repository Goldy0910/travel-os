import {
  LOCATION_SIGNIFICANT_CHANGE_KM,
  LOCATION_STALE_MS,
} from "@/lib/location/constants";
import type { UserLocation } from "@/lib/location/types";

const EARTH_RADIUS_KM = 6371;

/** Haversine distance in kilometers. */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isSignificantLocationChange(
  previous: UserLocation | null,
  next: { latitude: number; longitude: number },
  thresholdKm = LOCATION_SIGNIFICANT_CHANGE_KM,
): boolean {
  if (!previous) return true;
  return distanceKm(previous, next) >= thresholdKm;
}

export function isLocationStale(
  location: UserLocation | null,
  staleMs = LOCATION_STALE_MS,
): boolean {
  if (!location?.lastUpdated) return true;
  const t = Date.parse(location.lastUpdated);
  if (Number.isNaN(t)) return true;
  return Date.now() - t >= staleMs;
}
