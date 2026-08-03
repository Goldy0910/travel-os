/** Location feature constants — no magic numbers scattered in callers. */

export const LOCATION_STORAGE_KEY = "travel-os-user-location-v1";
export const LOCATION_PERMISSION_KEY = "travel-os-location-permission-v1";

/** Refresh GPS when stored location is older than this (4 hours). */
export const LOCATION_STALE_MS = 4 * 60 * 60 * 1000;

/** Treat moves beyond this distance as a significant location change (~50 km). */
export const LOCATION_SIGNIFICANT_CHANGE_KM = 50;

/** Geolocation options for navigator.geolocation. */
export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12_000,
  maximumAge: 60_000,
};

/** Manual city search debounce for settings (ms). */
export const MANUAL_LOCATION_DEBOUNCE_MS = 400;
