"use client";

import { fetchSavedPlaceIds } from "@/lib/saved-places/client";
import { useEffect, useMemo, useState } from "react";

/** Batch-check which place ids are saved for the current user. */
export function useSavedPlaceIds(placeIds: string[]) {
  const idsKey = useMemo(
    () =>
      [...new Set(placeIds.map((id) => id.trim()).filter(Boolean))]
        .sort()
        .join(","),
    [placeIds],
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!idsKey) {
      setSavedIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchSavedPlaceIds(idsKey.split(",")).then((ids) => {
      if (!cancelled) setSavedIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return savedIds;
}
