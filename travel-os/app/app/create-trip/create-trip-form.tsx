"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useFormActionFeedback } from "@/app/app/_components/use-form-action-feedback";
import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createTripAction } from "./actions";
import { TravelPlaceIconLoose } from "./travel-place-icon";
import type { TravelPlaceDTO } from "./travel-place-types";

function normalizeSearch(s: string) {
  return s.trim().toLowerCase();
}

function placeMatches(place: TravelPlaceDTO, q: string): boolean {
  if (!q) return true;
  const n = normalizeSearch(q);
  const slugPart = place.slug.replace(/-/g, " ");
  const hay = [place.primary_label, place.subtitle ?? "", place.canonical_location, slugPart, ...place.tags]
    .join(" ")
    .toLowerCase();
  return hay.includes(n);
}

export default function CreateTripForm({
  places,
  destinationsLoaded,
}: {
  places: TravelPlaceDTO[];
  destinationsLoaded: boolean;
}) {
  const { pending, handleForm } = useFormActionFeedback();
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [startDateValue, setStartDateValue] = useState("");
  const [endDateValue, setEndDateValue] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filteredPlaces = useMemo(() => {
    const q = normalizeSearch(query);
    return places.filter((p) => placeMatches(p, q));
  }, [places, query]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = containerRef.current;
      if (!el || !(e.target instanceof Node) || el.contains(e.target)) return;
      setListOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const fieldClass =
    "box-border min-h-0 min-w-0 max-w-full rounded-xl border px-4 text-base text-slate-900 outline-none transition focus:ring-2 focus:ring-slate-200";
  const placeFieldBorder = listOpen
    ? "border-slate-900 ring-2 ring-slate-200"
    : "border-slate-300 focus:border-slate-500";

  const dateFieldClass = `${fieldClass} border-slate-300 h-12 w-full max-w-full focus:border-slate-500`;
  const now = new Date();
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  function friendlyDate(ymd: string): string {
    if (!ymd) return "";
    const d = new Date(`${ymd}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  }

  const pickPlace = (place: TravelPlaceDTO) => {
    setSelectedSlug(place.slug);
    setQuery(place.canonical_location);
    setListOpen(false);
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    setSelectedSlug(null);
  };

  return (
    <form onSubmit={(e) => handleForm(e, createTripAction)} className="min-w-0 space-y-4">
      <input type="hidden" name="travelPlaceSlug" value={selectedSlug ?? ""} />

      <div ref={containerRef} className="relative min-w-0">
        <label htmlFor="placeQuery" className="mb-1 block text-sm font-medium text-slate-700">
          Place
        </label>
        <input
          id="placeQuery"
          type="text"
          autoComplete="off"
          placeholder="Search or select destination"
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setListOpen(true);
          }}
          onFocus={() => destinationsLoaded && setListOpen(true)}
          disabled={pending || !destinationsLoaded}
          className={`${fieldClass} ${placeFieldBorder} h-12 w-full disabled:opacity-60`}
        />

        {listOpen && destinationsLoaded && filteredPlaces.length > 0 ? (
          <div
            id="travel-place-suggestions"
            className="absolute left-0 right-0 top-full z-[120] mt-2 max-h-[min(18rem,calc(100vh-12rem))] touch-pan-y overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white py-2 shadow-lg [-webkit-overflow-scrolling:touch]"
          >
            {filteredPlaces.map((place) => (
              <button
                key={place.slug}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickPlace(place)}
              >
                <TravelPlaceIconLoose iconKey={place.icon_key} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-slate-900">
                    {place.primary_label}
                    {place.subtitle ? (
                      <span className="font-normal text-slate-600"> · {place.subtitle}</span>
                    ) : null}
                  </span>
                  {place.visa_note ? (
                    <span className="mt-0.5 block text-xs text-slate-500">{place.visa_note}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {destinationsLoaded && selectedSlug == null && query.trim().length > 0 ? (
        <p className="text-xs text-amber-800">
          Tap a destination in the list to confirm. Only listed places can be saved.
        </p>
      ) : null}

      <div className="min-w-0 max-w-full overflow-x-clip">
        <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-slate-700">
          Start date
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          value={startDateValue}
          min={todayYmd}
          onChange={(e) => {
            const nextStart = e.target.value;
            setStartDateValue(nextStart);
            if (endDateValue && nextStart && endDateValue < nextStart) {
              setEndDateValue(nextStart);
            }
          }}
          className={dateFieldClass}
          required
          disabled={pending}
        />
        {startDateValue ? (
          <p className="mt-1 text-xs text-slate-500">Selected: {friendlyDate(startDateValue)}</p>
        ) : null}
      </div>

      <div className="min-w-0 max-w-full overflow-x-clip">
        <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-slate-700">
          End date
        </label>
        <input
          id="endDate"
          name="endDate"
          type="date"
          value={endDateValue}
          min={startDateValue || todayYmd}
          onChange={(e) => setEndDateValue(e.target.value)}
          className={dateFieldClass}
          required
          disabled={pending}
        />
        {endDateValue ? (
          <p className="mt-1 text-xs text-slate-500">Selected: {friendlyDate(endDateValue)}</p>
        ) : null}
      </div>

      <div className="pt-2 text-sm">
        <Link href="/app/trips" className="inline-flex items-center gap-2 text-slate-500 underline">
          Cancel
          <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-500" />
        </Link>
      </div>

      <div className="fixed bottom-[var(--travel-os-sticky-cta-bottom)] left-0 right-0 z-[110] box-border pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
        <button
          type="submit"
          disabled={pending || !destinationsLoaded || !selectedSlug}
          className="mx-auto flex h-12 w-full max-w-md min-w-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-base font-medium text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
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
