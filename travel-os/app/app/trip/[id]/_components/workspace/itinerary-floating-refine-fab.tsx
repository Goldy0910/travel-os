"use client";

import TripFabAnchor from "../trip-fab-anchor";
import { Sparkles } from "lucide-react";
import { useItineraryRefinementOptional } from "./itinerary-refinement-context";

/** Floating refine control — sits above sticky bar + bottom nav. */
export default function ItineraryFloatingRefineFab() {
  const refinement = useItineraryRefinementOptional();
  if (!refinement) return null;

  return (
    <TripFabAnchor
      bottomClassName="bottom-[calc(var(--travel-os-bottom-nav-h)+var(--travel-os-itinerary-sticky-h)+0.35rem)]"
      zClassName="z-[108]"
    >
      <button
        type="button"
        onClick={() => refinement.openRefinement()}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg shadow-teal-900/25 transition-transform duration-200 active:scale-95 touch-manipulation motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
        aria-label="Refine itinerary with AI"
        title="Refine"
      >
        <Sparkles className="h-6 w-6" aria-hidden />
      </button>
    </TripFabAnchor>
  );
}
