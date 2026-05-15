"use client";

import { WORKSPACE_REFINEMENT_CHIPS } from "@/lib/itinerary-workspace/quick-refinements";
import { getQuickAction } from "@/lib/trip-refinement";
import { Sparkles } from "lucide-react";
import { useItineraryRefinementOptional } from "./itinerary-refinement-context";

type Props = {
  disabled?: boolean;
};

export default function ItineraryQuickRefinements({ disabled }: Props) {
  const refinement = useItineraryRefinementOptional();

  if (!refinement) return null;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 px-0.5">
        <Sparkles className="h-4 w-4 text-teal-600" aria-hidden />
        <h2 className="text-sm font-bold tracking-tight text-slate-900">Quick refinements</h2>
      </div>
      <div className="scrollbar-hide trip-snap-x -mx-1 flex gap-2 overflow-x-auto pb-1 pl-1 pr-1 scroll-px-1">
        {WORKSPACE_REFINEMENT_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              const action = getQuickAction(chip.id);
              if (action) refinement.runQuickAction(chip.id, action.prompt);
            }}
            className="min-h-11 shrink-0 snap-start rounded-full border border-teal-200 bg-white px-4 py-2.5 text-xs font-semibold text-teal-900 shadow-sm transition active:scale-[0.97] disabled:opacity-50 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}
