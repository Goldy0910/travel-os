"use client";

import LocationPermissionDialog from "@/app/app/_components/location-permission-dialog";
import {
  LocationPermissionManager,
  LocationService,
  toPromptContext,
  type LocationPermissionChoice,
  type UserLocation,
  type UserLocationPromptContext,
} from "@/lib/location";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

type LocationContextValue = {
  location: UserLocation | null;
  permission: LocationPermissionChoice;
  busy: boolean;
  error: string | null;
  /** City/state/country for AI — null when disabled or missing. */
  promptContext: UserLocationPromptContext | null;
  /** Show the friendly dialog once if choice is still unknown. */
  promptForPermissionIfNeeded: () => void;
  allowLocation: () => Promise<void>;
  dismissPermissionPrompt: () => void;
  refreshLocation: (opts?: { force?: boolean }) => Promise<void>;
  setLocationEnabled: (enabled: boolean) => Promise<void>;
  setManualLocation: (query: string) => Promise<void>;
  clearLocation: () => Promise<void>;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function useUserLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useUserLocation must be used within UserLocationProvider");
  }
  return ctx;
}

/** Safe hook when provider might be absent (e.g. isolated stories). */
export function useUserLocationOptional(): LocationContextValue | null {
  return useContext(LocationContext);
}

type UserLocationProviderProps = {
  children: React.ReactNode;
  /** If true, auto-open permission dialog on first app shell visit when unknown. */
  promptOnMount?: boolean;
};

export function UserLocationProvider({
  children,
  promptOnMount = true,
}: UserLocationProviderProps) {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permission, setPermission] = useState<LocationPermissionChoice>("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setPermission(LocationPermissionManager.getChoice());
    setLocation(LocationService.getStoredLocation());

    const unsub = LocationService.subscribeToLocationUpdates((next) => {
      setLocation(next);
    });

    void (async () => {
      try {
        const hydrated = await LocationService.hydrate({ refreshIfStale: true });
        setLocation(hydrated);
        setPermission(LocationPermissionManager.getChoice());
      } catch {
        /* keep local */
      } finally {
        hydratedRef.current = true;
        if (promptOnMount && LocationPermissionManager.shouldPrompt()) {
          // Slight delay so the shell paints first
          window.setTimeout(() => setDialogOpen(true), 600);
        }
      }
    })();

    return unsub;
  }, [promptOnMount]);

  const promptForPermissionIfNeeded = useCallback(() => {
    if (LocationPermissionManager.shouldPrompt()) {
      setDialogOpen(true);
    }
  }, []);

  const dismissPermissionPrompt = useCallback(() => {
    LocationPermissionManager.setChoice("dismissed");
    setPermission("dismissed");
    setDialogOpen(false);
  }, []);

  const allowLocation = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await LocationService.refreshLocation({ force: true });
      setLocation(next);
      setPermission(LocationPermissionManager.getChoice());
      setDialogOpen(false);
      const label = [next.city, next.country].filter(Boolean).join(", ");
      toast.success(label ? `Location set to ${label}` : "Location enabled");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not enable location";
      setError(msg);
      setPermission(LocationPermissionManager.getChoice());
      toast.error(msg);
      setDialogOpen(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshLocation = useCallback(async (opts?: { force?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      const next = await LocationService.refreshLocation({ force: opts?.force ?? true });
      setLocation(next);
      setPermission(LocationPermissionManager.getChoice());
      const label = [next.city, next.country].filter(Boolean).join(", ");
      toast.success(label ? `Updated to ${label}` : "Location refreshed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not refresh location";
      setError(msg);
      toast.error(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const setLocationEnabled = useCallback(async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        const current = LocationService.getStoredLocation();
        if (!current) {
          await refreshLocation({ force: true });
          return;
        }
        const next = await LocationService.setEnabled(true);
        setLocation(next);
        LocationPermissionManager.setChoice("granted");
        setPermission("granted");
        toast.success("Location enabled for personalization");
      } else {
        const next = await LocationService.setEnabled(false);
        setLocation(next);
        toast.message("Location disabled for AI personalization");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update location setting";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [refreshLocation]);

  const setManualLocation = useCallback(async (query: string) => {
    setBusy(true);
    setError(null);
    try {
      const { forwardGeocodeClient } = await import("@/lib/location/geocoder-client");
      const hit = await forwardGeocodeClient(query);
      if (!hit) {
        throw new Error("Could not find that place. Try a city name.");
      }
      const next = await LocationService.setManualLocation(hit);
      setLocation(next);
      setPermission("granted");
      const label = [next.city, next.country].filter(Boolean).join(", ") || query;
      toast.success(`Location set to ${label}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not set location";
      setError(msg);
      toast.error(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const clearLocation = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await LocationService.clearLocation();
      setLocation(null);
      toast.message("Saved location cleared");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not clear location";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, []);

  const promptContext = useMemo(() => toPromptContext(location), [location]);

  const value = useMemo<LocationContextValue>(
    () => ({
      location,
      permission,
      busy,
      error,
      promptContext,
      promptForPermissionIfNeeded,
      allowLocation,
      dismissPermissionPrompt,
      refreshLocation,
      setLocationEnabled,
      setManualLocation,
      clearLocation,
    }),
    [
      location,
      permission,
      busy,
      error,
      promptContext,
      promptForPermissionIfNeeded,
      allowLocation,
      dismissPermissionPrompt,
      refreshLocation,
      setLocationEnabled,
      setManualLocation,
      clearLocation,
    ],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
      <LocationPermissionDialog
        open={dialogOpen}
        busy={busy}
        onAllow={() => void allowLocation()}
        onNotNow={dismissPermissionPrompt}
      />
    </LocationContext.Provider>
  );
}
