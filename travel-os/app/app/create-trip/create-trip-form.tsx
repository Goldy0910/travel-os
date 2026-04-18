"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useFormActionFeedback } from "@/app/app/_components/use-form-action-feedback";
import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import Link from "next/link";
import { useMemo, useState } from "react";
import { resolveDestination } from "@/app/app/_lib/destination-intel";
import { createTripAction } from "./actions";

const PLACE_SUGGESTIONS = [
  "Tokyo, Japan",
  "Bangkok, Thailand",
  "Dubai, United Arab Emirates",
  "Singapore, Singapore",
  "Bali, Indonesia",
  "Paris, France",
  "London, United Kingdom",
  "Rome, Italy",
  "Barcelona, Spain",
  "New York, United States",
];

export default function CreateTripForm() {
  const { pending, handleForm } = useFormActionFeedback();
  const [location, setLocation] = useState("");
  const [autofillApplied, setAutofillApplied] = useState(false);
  const destinationIntel = useMemo(() => resolveDestination(location), [location]);
  const placeSuggestionChips = useMemo(() => {
    const query = location.trim().toLowerCase();
    if (!query) return PLACE_SUGGESTIONS.slice(0, 6);
    return PLACE_SUGGESTIONS.filter((place) => place.toLowerCase().includes(query)).slice(0, 6);
  }, [location]);
  const showDetected =
    !autofillApplied &&
    location.trim().length > 0 &&
    destinationIntel.country.trim().length > 0 &&
    destinationIntel.country !== "Unknown";
  const showPlaceSuggestions = !autofillApplied && placeSuggestionChips.length > 0;
  const detectedLabel = `${destinationIntel.city}, ${destinationIntel.country}`;

  return (
    <form onSubmit={(e) => handleForm(e, createTripAction)} className="space-y-4">
      <div>
        <label htmlFor="location" className="mb-1 block text-sm font-medium text-slate-700">
          Place
        </label>
        <input
          id="location"
          name="location"
          type="text"
          placeholder="Tokyo"
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setAutofillApplied(false);
          }}
          className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          required
          disabled={pending}
        />
        {showPlaceSuggestions ? (
          <div className="mt-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Suggestions
            </p>
            <div className="flex flex-wrap gap-2">
              {placeSuggestionChips.map((place) => (
                <button
                  key={place}
                  type="button"
                  onClick={() => {
                    setLocation(place);
                    setAutofillApplied(true);
                  }}
                  className="max-w-full break-words rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-snug text-slate-700 transition active:scale-[0.98]"
                >
                  {place}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {showDetected ? (
          <button
            type="button"
            onClick={() => {
              setLocation(detectedLabel);
              setAutofillApplied(true);
            }}
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

      <div className="fixed bottom-[var(--travel-os-sticky-cta-bottom)] left-0 right-0 z-[110] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
        <button
          type="submit"
          disabled={pending}
          className="mx-auto flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-base font-medium text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
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
      </div>
    </form>
  );
}
