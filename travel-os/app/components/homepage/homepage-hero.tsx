"use client";

import { Compass, MapPin } from "lucide-react";

type Props = {
  onPlanTrip: () => void;
  onCheckDestination: () => void;
};

export default function HomepageHero({ onPlanTrip, onCheckDestination }: Props) {
  return (
    <section className="relative overflow-hidden px-4 pb-8 pt-6">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-50 via-white to-teal-50/40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-teal-200/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-amber-200/25 blur-3xl"
        aria-hidden
      />

      <div className="relative">
        <div className="mb-5 flex justify-center">
          <div className="relative h-36 w-full max-w-[280px] overflow-hidden rounded-3xl shadow-lg shadow-teal-900/10 ring-1 ring-white/80">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-400 via-emerald-500 to-sky-500" />
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/90">
                TravelTill99
              </p>
              <p className="text-lg font-bold text-white">Decide first. Plan smarter.</p>
            </div>
            <div className="absolute right-3 top-3 rounded-full bg-white/20 p-2 backdrop-blur-sm">
              <Compass className="h-6 w-6 text-white" aria-hidden />
            </div>
          </div>
        </div>

        <p className="text-center text-xs font-semibold uppercase tracking-wider text-teal-700">
          Decision-first travel
        </p>
        <h1 className="mt-2 text-center text-[1.75rem] font-bold leading-[1.15] tracking-tight text-slate-900">
          Not sure where to go? We&apos;ll help you decide.
        </h1>
        <p className="mt-4 text-center text-[0.9375rem] leading-relaxed text-slate-600">
          Tell us how much time you have and what kind of trip you want.
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
            onClick={onPlanTrip}
            className="inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition active:scale-[0.98] touch-manipulation"
          >
            <Compass className="h-5 w-5" aria-hidden />
            Plan My Trip
          </button>
          <button
            type="button"
            onClick={onCheckDestination}
            className="inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 shadow-sm transition active:scale-[0.98] touch-manipulation"
          >
            <MapPin className="h-5 w-5 text-teal-600" aria-hidden />
            Check My Destination
          </button>
        </div>
      </div>
    </section>
  );
}
