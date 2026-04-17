"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useFormActionFeedback } from "@/app/app/_components/use-form-action-feedback";
import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import Link from "next/link";
import { useMemo, useState } from "react";
import { resolveDestination } from "@/app/app/_lib/destination-intel";
import { createTripAction } from "./actions";

export default function CreateTripForm() {
  const { pending, handleForm } = useFormActionFeedback();
  const [location, setLocation] = useState("");
  const destinationIntel = useMemo(() => resolveDestination(location), [location]);
  const showDetected =
    location.trim().length > 0 &&
    destinationIntel.country.trim().length > 0 &&
    destinationIntel.country !== "Unknown";
  const detectedLabel = `${destinationIntel.city}, ${destinationIntel.country}`;

  return (
    <form onSubmit={(e) => handleForm(e, createTripAction)} className="space-y-4">
      <div>
        <label htmlFor="location" className="mb-1 block text-sm font-medium text-slate-700">
          Location
        </label>
        <input
          id="location"
          name="location"
          type="text"
          placeholder="Tokyo"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          required
          disabled={pending}
        />
        {showDetected ? (
          <button
            type="button"
            onClick={() => setLocation(detectedLabel)}
            className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-xs font-medium text-indigo-800"
          >
            Detected: {detectedLabel}
            <span className="ml-1 text-indigo-600 underline">Tap to autofill</span>
          </button>
        ) : null}
      </div>

      <div>
        <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-slate-700">
          Start date
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          required
          disabled={pending}
        />
      </div>

      <div>
        <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-slate-700">
          End date
        </label>
        <input
          id="endDate"
          name="endDate"
          type="date"
          className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          required
          disabled={pending}
        />
      </div>

      <div className="pt-2 text-sm">
        <Link
          href="/app/trips"
          className="inline-flex items-center gap-2 text-slate-500 underline"
        >
          Cancel
          <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-500" />
        </Link>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="fixed bottom-[var(--travel-os-sticky-cta-bottom)] left-1/2 z-[110] flex h-12 w-[min(28rem,calc(100vw-2rem-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)))] -translate-x-1/2 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-base font-medium text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? (
          <>
            <ButtonSpinner className="h-4 w-4 text-white" />
            Creating…
          </>
        ) : (
          "Save trip"
        )}
      </button>
    </form>
  );
}
