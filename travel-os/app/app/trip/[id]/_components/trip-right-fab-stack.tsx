"use client";

import { Plus, Sparkles, Wand2 } from "lucide-react";
import { useTripFabRegistry } from "../_lib/trip-tab-fab-registry";
import { useItineraryRefinementOptional } from "./workspace/itinerary-refinement-context";
import { useTripItineraryAssistantOptional } from "./trip-itinerary-assistant-context";

const FAB_CLASS =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg transition-transform duration-200 active:scale-95 touch-manipulation motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

type Props = {
  showRefine?: boolean;
  showAssistant?: boolean;
};

/**
 * Single right-side FAB column for the itinerary tab.
 * Sits above the sticky action bar; matches tab panel horizontal padding (px-4).
 */
export default function TripRightFabStack({ showRefine = false, showAssistant = true }: Props) {
  const { triggerAddActivity } = useTripFabRegistry();
  const refinement = useItineraryRefinementOptional();
  const assistant = useTripItineraryAssistantOptional();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--travel-os-bottom-nav-h)+0.75rem)] z-[108]"
      aria-label="Trip quick actions"
    >
      {/* pointer-events-none on the row so taps pass through to itinerary links; only buttons capture touches */}
      <div className="pointer-events-none mx-auto flex w-full max-w-[390px] flex-col items-end gap-2.5 px-4">
        {showAssistant && assistant ? (
          <button
            type="button"
            onClick={() => assistant.openAssistant()}
            className={`pointer-events-auto ${FAB_CLASS} bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-900/25 focus-visible:ring-indigo-400`}
            aria-label="AI Assistant"
            title="AI Assistant"
          >
            <Sparkles className="h-5 w-5" aria-hidden />
          </button>
        ) : null}

        {showRefine && refinement ? (
          <button
            type="button"
            onClick={() => refinement.openRefinement()}
            className={`pointer-events-auto ${FAB_CLASS} bg-teal-600 text-white shadow-teal-900/20 focus-visible:ring-teal-400`}
            aria-label="Refine itinerary"
            title="Refine"
          >
            <Wand2 className="h-5 w-5" aria-hidden />
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => triggerAddActivity()}
          className={`pointer-events-auto ${FAB_CLASS} bg-slate-900 text-white text-xl font-light leading-none shadow-slate-900/25 focus-visible:ring-slate-400`}
          aria-label="Add activity"
          title="Add activity"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}
