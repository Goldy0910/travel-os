import type { TripDurationPreset } from "./types";

/** Duration preset → day count (homepage UI helper). */
export function presetToDays(preset: string, customDays?: number): number {
  switch (preset) {
    case "weekend":
      return 2;
    case "3-days":
      return 3;
    case "5-days":
      return 5;
    case "1-week":
      return 7;
    case "custom":
      return Math.min(30, Math.max(1, customDays ?? 5));
    default:
      return 5;
  }
}

export type { TripDurationPreset };
