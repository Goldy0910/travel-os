"use client";

import { Plus, Sparkles } from "lucide-react";
import { useTripFabRegistry } from "../../_lib/trip-tab-fab-registry";
import { useItineraryRefinementOptional } from "./itinerary-refinement-context";

type Props = {
  showRefine: boolean;
};

export default function ItineraryStickyActions({ showRefine }: Props) {
  const { triggerAddActivity } = useTripFabRegistry();
  const refinement = useItineraryRefinementOptional();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[var(--travel-os-bottom-nav-h)] z-[105] px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
      role="toolbar"
      aria-label="Itinerary actions"
    >
      <div className="pointer-events-auto mx-auto flex max-w-[390px] gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-xl shadow-slate-900/10 backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
        <button
          type="button"
          onClick={() => triggerAddActivity()}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add activity
        </button>
        {showRefine && refinement ? (
          <button
            type="button"
            onClick={() => refinement.openRefinement()}
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-900 touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
            aria-label="Refine with AI"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Refine
          </button>
        ) : null}
      </div>
    </div>
  );
}
