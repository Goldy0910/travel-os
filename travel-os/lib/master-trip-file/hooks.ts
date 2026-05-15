"use client";

import type { HomepageDecisionResponse } from "@/lib/homepage-decision/types";
import type { MasterTripPreferences } from "./types";

/** Client-side payload builder for saveMasterTripAction. */
export function buildSaveMasterTripPayload(input: {
  decision: HomepageDecisionResponse;
  preferences: MasterTripPreferences;
  travelPlaceSlug?: string | null;
}): FormData {
  const fd = new FormData();
  fd.set("payload", JSON.stringify(input));
  return fd;
}

export const MASTER_TRIP_LIST_PATH = "/app/trips";
export function masterTripDetailPath(id: string): string {
  return `/app/master-trip/${encodeURIComponent(id)}`;
}
