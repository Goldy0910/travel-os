"use client";

import type { NormalizedTripPlan } from "@/lib/unified-trip";
import { ChevronRight, CloudSun, IndianRupee, MapPin, Route, Sparkles } from "lucide-react";
import { useState } from "react";

type Props = {
  plan: NormalizedTripPlan;
  dayCount: number;
  defaultExpanded?: boolean;
};

export default function TripSummaryPanel({
  plan,
  dayCount,
  defaultExpanded = true,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/90 to-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left touch-manipulation"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">
            Trip summary
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-base font-bold text-slate-900">
            <MapPin className="h-4 w-4 text-teal-600" aria-hidden />
            {plan.destination.name}
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            {dayCount} days · {plan.summary.slice(0, 80)}
            {plan.summary.length > 80 ? "…" : ""}
          </p>
        </span>
        <ChevronRight
          className={`mt-2 h-5 w-5 shrink-0 text-slate-400 transition ${expanded ? "rotate-90" : ""}`}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-teal-100/80 px-4 pb-4 pt-3">
          {plan.whyThisFits.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Why this fits</h3>
              <ul className="mt-2 space-y-2">
                {plan.whyThisFits.map((line) => (
                  <li key={line} className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/80 p-3 ring-1 ring-teal-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
                <Route className="h-3.5 w-3.5" /> Effort
              </div>
              <p className="mt-1 text-sm font-medium text-slate-800">{plan.travelEffort}</p>
            </div>
            <div className="rounded-xl bg-white/80 p-3 ring-1 ring-teal-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
                <IndianRupee className="h-3.5 w-3.5" /> Budget
              </div>
              <p className="mt-1 text-sm font-medium text-slate-800">{plan.budget}</p>
            </div>
          </div>

          {plan.weather ? (
            <div className="rounded-xl bg-white/80 p-3 ring-1 ring-teal-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
                <CloudSun className="h-3.5 w-3.5" /> Weather
              </div>
              <p className="mt-1 text-sm font-medium text-slate-800">{plan.weather}</p>
            </div>
          ) : null}

          {plan.recommendationExplanation ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recommendation</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {plan.recommendationExplanation}
              </p>
            </div>
          ) : null}

          <p className="text-center text-xs text-slate-500">
            Edit your day-by-day timeline below — tap the sparkle button to refine with AI.
          </p>
        </div>
      ) : null}
    </section>
  );
}
