"use client";

import { fetchDestinationInterestBatch } from "@/lib/destination-interest/client";
import type { DestinationInterestSnapshot } from "@/lib/destination-interest/types";
import { useEffect, useMemo, useState } from "react";

export function useDestinationInterest(destinationIds: string[]) {
  const idsKey = useMemo(
    () =>
      [...new Set(destinationIds.map((id) => id.trim().toLowerCase()).filter(Boolean))]
        .sort()
        .join(","),
    [destinationIds],
  );
  const [byId, setById] = useState<Record<string, DestinationInterestSnapshot>>({});

  useEffect(() => {
    if (!idsKey) {
      setById({});
      return;
    }
    let cancelled = false;
    const ids = idsKey.split(",");
    void fetchDestinationInterestBatch(ids)
      .then((map) => {
        if (cancelled) return;
        const next: Record<string, DestinationInterestSnapshot> = {};
        for (const [id, snapshot] of map) next[id] = snapshot;
        setById(next);
      })
      .catch(() => {
        if (!cancelled) setById({});
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return byId;
}
