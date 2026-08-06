"use client";

import { trackDestinationInterestClient } from "@/lib/destination-interest/client";
import { resolveTopLevelDestination } from "@/lib/destination-interest/resolve";
import {
  fetchSavedPlaceIds,
  savePlaceClient,
  unsavePlaceClient,
} from "@/lib/saved-places/client";
import type { SavedPlaceInput } from "@/lib/saved-places/types";
import { Heart, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

export type SavePlaceButtonProps = {
  place: SavedPlaceInput;
  /** Compact circular heart (cards) vs labeled button (drawer). */
  variant?: "icon" | "button";
  className?: string;
  /** When true, stop click from opening parent card/drawer. */
  stopPropagation?: boolean;
  /** Seed saved state (e.g. Saved page list already knows). */
  initialSaved?: boolean;
  onSavedChange?: (saved: boolean) => void;
};

export default function SavePlaceButton({
  place,
  variant = "button",
  className,
  stopPropagation = false,
  initialSaved = false,
  onSavedChange,
}: SavePlaceButtonProps) {
  const placeId = place.placeId.trim();
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(initialSaved);

  const destinationId = useMemo(() => {
    if (place.destinationId) return place.destinationId;
    return (
      resolveTopLevelDestination({
        name: place.name,
        type: place.category || "place",
      })?.id ?? null
    );
  }, [place.destinationId, place.name, place.category]);

  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    setReady(false);
    void fetchSavedPlaceIds([placeId]).then((ids) => {
      if (cancelled) return;
      setSaved(ids.has(placeId));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  async function toggle(event: MouseEvent) {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!placeId || loading) return;
    setLoading(true);
    const next = !saved;
    setSaved(next);
    onSavedChange?.(next);
    try {
      if (next) {
        const result = await savePlaceClient({
          ...place,
          destinationId: destinationId ?? place.destinationId ?? null,
        });
        if (!result.ok) {
          setSaved(false);
          onSavedChange?.(false);
          return;
        }
        if (destinationId) {
          trackDestinationInterestClient(destinationId, "FAVORITE");
        }
      } else {
        const result = await unsavePlaceClient(placeId);
        if (!result.ok) {
          setSaved(true);
          onSavedChange?.(true);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={(event) => void toggle(event)}
        disabled={!ready || loading || !placeId}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved" : "Save place"}
        className={
          className ??
          "inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-white disabled:opacity-60"
        }
      >
        {loading ? (
          <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <Heart
            className={`h-3.5 w-3.5 ${saved ? "fill-rose-500 text-rose-500" : ""}`}
            aria-hidden
          />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => void toggle(event)}
      disabled={!ready || loading || !placeId}
      aria-pressed={saved}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
      }
    >
      {loading ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Heart
          className={`h-3.5 w-3.5 ${saved ? "fill-rose-500 text-rose-500" : "text-slate-500"}`}
          aria-hidden
        />
      )}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
