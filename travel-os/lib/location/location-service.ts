import { GEOLOCATION_OPTIONS } from "@/lib/location/constants";
import {
  isLocationStale,
  isSignificantLocationChange,
} from "@/lib/location/geo";
import { reverseGeocodeClient } from "@/lib/location/geocoder-client";
import { LocationPermissionManager } from "@/lib/location/permission";
import {
  clearStoredLocation,
  getStoredLocation,
  setStoredLocation,
} from "@/lib/location/storage";
import type {
  LocationPermissionChoice,
  LocationSource,
  UserLocation,
  UserLocationPromptContext,
} from "@/lib/location/types";
import { toPromptContext } from "@/lib/location/types";

export type LocationListener = (location: UserLocation | null) => void;

const listeners = new Set<LocationListener>();

function emit(location: UserLocation | null) {
  for (const fn of listeners) {
    try {
      fn(location);
    } catch {
      /* listener errors must not break the service */
    }
  }
}

async function persistToProfile(location: UserLocation | null): Promise<void> {
  try {
    await fetch("/api/location/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location }),
    });
  } catch {
    /* offline / unauthenticated — local storage still works */
  }
}

async function loadFromProfile(): Promise<UserLocation | null> {
  try {
    const res = await fetch("/api/location/profile", { method: "GET" });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; location?: UserLocation | null };
    if (!data.ok || !data.location) return null;
    return data.location;
  } catch {
    return null;
  }
}

function buildLocation(input: {
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  country: string | null;
  source: LocationSource;
  enabled?: boolean;
}): UserLocation {
  return {
    latitude: input.latitude,
    longitude: input.longitude,
    city: input.city,
    state: input.state,
    country: input.country,
    lastUpdated: new Date().toISOString(),
    source: input.source,
    enabled: input.enabled ?? true,
  };
}

/**
 * Central LocationService — reuse across chat, maps, weather, nearby, etc.
 * Coordinates stay internal; use getPromptContext() for AI.
 */
export const LocationService = {
  getStoredLocation,
  getCurrentLocation: getStoredLocation,

  getPermissionChoice(): LocationPermissionChoice {
    return LocationPermissionManager.getChoice();
  },

  requestLocationPermission() {
    return LocationPermissionManager.requestBrowserPermission();
  },

  /** City/state/country only — safe for AI system prompts. */
  getPromptContext(): UserLocationPromptContext | null {
    return toPromptContext(getStoredLocation());
  },

  subscribeToLocationUpdates(listener: LocationListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async clearLocation(): Promise<void> {
    clearStoredLocation();
    emit(null);
    await persistToProfile(null);
  },

  async setEnabled(enabled: boolean): Promise<UserLocation | null> {
    const current = getStoredLocation();
    if (!current) return null;
    const next = { ...current, enabled };
    setStoredLocation(next);
    emit(next);
    await persistToProfile(next);
    return next;
  },

  /**
   * Apply a manual city override. Disables auto GPS overwrite until reset via refreshLocation(forceGps).
   */
  async setManualLocation(input: {
    latitude: number;
    longitude: number;
    city: string | null;
    state: string | null;
    country: string | null;
  }): Promise<UserLocation> {
    LocationPermissionManager.setChoice("granted");
    const next = buildLocation({ ...input, source: "manual", enabled: true });
    setStoredLocation(next);
    emit(next);
    await persistToProfile(next);
    return next;
  },

  /**
   * Hydrate from local storage, then profile. Optionally refresh GPS if stale.
   * Safe to call on every app open — does not re-prompt permission.
   */
  async hydrate(options?: { refreshIfStale?: boolean }): Promise<UserLocation | null> {
    let local = getStoredLocation();
    const profile = await loadFromProfile();

    if (profile) {
      const profileNewer =
        !local ||
        Date.parse(profile.lastUpdated) > Date.parse(local.lastUpdated || "");
      if (profileNewer) {
        setStoredLocation(profile);
        local = profile;
        emit(local);
      } else if (local && !profileNewer) {
        // Local is newer — push up once
        void persistToProfile(local);
      }
    }

    if (
      options?.refreshIfStale !== false &&
      local?.enabled &&
      local.source !== "manual" &&
      LocationPermissionManager.getChoice() === "granted" &&
      isLocationStale(local)
    ) {
      try {
        return await this.refreshLocation({ quiet: true });
      } catch {
        return local;
      }
    }

    return local;
  },

  /**
   * Read GPS + reverse geocode. Respects permission choice unless force.
   * Detects significant moves and updates stored location.
   */
  async refreshLocation(options?: {
    force?: boolean;
    quiet?: boolean;
  }): Promise<UserLocation> {
    const choice = LocationPermissionManager.getChoice();
    if (!options?.force && choice !== "granted") {
      throw new Error(
        choice === "unknown"
          ? "Location permission has not been granted yet."
          : "Location access is turned off. Enable it in Settings.",
      );
    }

    const previous = getStoredLocation();
    // Manual override: only replace when force (user tapped Refresh / Use GPS)
    if (previous?.source === "manual" && !options?.force) {
      return previous;
    }

    const req = await LocationPermissionManager.requestBrowserPermission();
    if (!req.ok || !req.position) {
      throw new Error(req.error || "Could not read your location.");
    }

    const { latitude, longitude } = req.position.coords;
    let city: string | null = previous?.city ?? null;
    let state: string | null = previous?.state ?? null;
    let country: string | null = previous?.country ?? null;

    const moved = isSignificantLocationChange(previous, { latitude, longitude });
    const needsGeocode =
      moved || !city || !country || isLocationStale(previous);

    if (needsGeocode) {
      try {
        const geo = await reverseGeocodeClient(latitude, longitude);
        city = geo.city;
        state = geo.state;
        country = geo.country;
      } catch {
        if (!options?.quiet) {
          // Keep coords even if geocode fails
        }
      }
    }

    const next = buildLocation({
      latitude,
      longitude,
      city,
      state,
      country,
      source: "gps",
      enabled: previous?.enabled ?? true,
    });

    setStoredLocation(next);
    emit(next);
    await persistToProfile(next);
    return next;
  },

  /** Browser geolocation only (no reverse geocode) — low-level helper. */
  async getBrowserPosition(): Promise<GeolocationPosition> {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("Geolocation is not supported in this browser.");
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, GEOLOCATION_OPTIONS);
    });
  },
};
