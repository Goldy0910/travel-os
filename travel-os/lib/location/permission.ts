import { GEOLOCATION_OPTIONS } from "@/lib/location/constants";
import {
  getStoredPermissionChoice,
  setStoredPermissionChoice,
} from "@/lib/location/storage";
import type { LocationPermissionChoice } from "@/lib/location/types";

/**
 * Permission manager — remembers the in-app choice so we never re-prompt
 * after Allow / Not Now / Denied unless the user opens Settings.
 */
export const LocationPermissionManager = {
  getChoice(): LocationPermissionChoice {
    return getStoredPermissionChoice();
  },

  setChoice(choice: LocationPermissionChoice): void {
    setStoredPermissionChoice(choice);
  },

  /** True when we should show the friendly first-run dialog. */
  shouldPrompt(): boolean {
    return this.getChoice() === "unknown";
  },

  /**
   * Request browser geolocation permission by attempting a position read.
   * Updates stored choice based on success / error code.
   */
  async requestBrowserPermission(): Promise<{
    ok: boolean;
    position?: GeolocationPosition;
    choice: LocationPermissionChoice;
    error?: string;
  }> {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const choice: LocationPermissionChoice = "denied";
      this.setChoice(choice);
      return { ok: false, choice, error: "Geolocation is not supported in this browser." };
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, GEOLOCATION_OPTIONS);
      });
      this.setChoice("granted");
      return { ok: true, position, choice: "granted" };
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? Number((err as GeolocationPositionError).code)
          : null;
      // PERMISSION_DENIED = 1
      const choice: LocationPermissionChoice = code === 1 ? "denied" : "dismissed";
      this.setChoice(choice);
      const message =
        err instanceof Error
          ? err.message
          : code === 1
            ? "Location permission was denied."
            : "Could not read your location.";
      return { ok: false, choice, error: message };
    }
  },
};
