"use client";

import DocumentChecklist from "@/app/app/visa/_components/DocumentChecklist";
import StepGuide from "@/app/app/visa/_components/StepGuide";
import TimelineCard from "@/app/app/visa/_components/TimelineCard";
import VisaCard from "@/app/app/visa/_components/VisaCard";
import VisaRecommendations from "@/app/app/visa/_components/VisaRecommendations";
import type { VisaGuide } from "@/app/app/visa/_lib/visa-data";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type TripOption = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
};

type VisaPageProps = {
  trips: TripOption[];
  selectedTripId: string;
  visaGuide: VisaGuide;
};

function normalizeDestination(destination: string): string {
  const value = destination.trim();
  if (!value) return "Destination";
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts[0] || value;
}

function getDurationDays(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate.slice(0, 10)}T12:00:00`);
  const end = new Date(`${endDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

export default function VisaPage({ trips, selectedTripId, visaGuide }: VisaPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [switchingTripId, setSwitchingTripId] = useState<string | null>(null);
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? trips[0];
  const destinationKey = normalizeDestination(selectedTrip?.destination ?? "");
  const tripDurationDays = getDurationDays(selectedTrip.startDate, selectedTrip.endDate);

  return (
    <main className="min-h-screen bg-slate-50 pb-28 pt-3">
      <div className="relative mx-auto w-full max-w-md space-y-4 px-4">
        {isPending ? (
          <div className="absolute inset-0 z-20 flex items-start justify-center rounded-2xl bg-slate-50/80 pt-24 backdrop-blur-[1px]">
            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
                aria-hidden
              />
              Loading visa details...
            </div>
          </div>
        ) : null}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Visa</h1>
          <p className="mt-1 text-sm text-slate-600">Plan requirements, documents, and timeline for your trip.</p>
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Trip</span>
            <select
              value={switchingTripId ?? selectedTrip.id}
              disabled={isPending}
              onChange={(e) => {
                const nextTripId = e.target.value;
                if (!nextTripId || nextTripId === selectedTrip.id) return;
                setSwitchingTripId(nextTripId);
                const nextHref = `/app/visa?trip=${encodeURIComponent(nextTripId)}`;
                router.prefetch(nextHref);
                startTransition(() => {
                  router.replace(nextHref);
                });
              }}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800"
            >
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                </option>
              ))}
            </select>
          </label>
        </section>

        <VisaCard destination={destinationKey} info={visaGuide.info} tripDurationDays={tripDurationDays} />
        <DocumentChecklist tripId={selectedTrip.id} checklistByType={visaGuide.checklistByType} />
        <VisaRecommendations recommendations={visaGuide.recommendations} />
        <TimelineCard tripStartDate={selectedTrip.startDate} />
        <StepGuide steps={visaGuide.steps} />
      </div>
    </main>
  );
}
