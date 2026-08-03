import {
  LOCATION_PERMISSION_KEY,
  LOCATION_STORAGE_KEY,
} from "@/lib/location/constants";
import {
  isUserLocation,
  type LocationPermissionChoice,
  type UserLocation,
} from "@/lib/location/types";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getStoredLocation(): UserLocation | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isUserLocation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setStoredLocation(location: UserLocation | null): void {
  if (!canUseStorage()) return;
  try {
    if (!location) {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch {
    /* quota / private mode */
  }
}

export function clearStoredLocation(): void {
  setStoredLocation(null);
}

export function getStoredPermissionChoice(): LocationPermissionChoice {
  if (!canUseStorage()) return "unknown";
  try {
    const raw = localStorage.getItem(LOCATION_PERMISSION_KEY);
    if (
      raw === "granted" ||
      raw === "denied" ||
      raw === "dismissed" ||
      raw === "unknown"
    ) {
      return raw;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function setStoredPermissionChoice(choice: LocationPermissionChoice): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(LOCATION_PERMISSION_KEY, choice);
  } catch {
    /* ignore */
  }
}
