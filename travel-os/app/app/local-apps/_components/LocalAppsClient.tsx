"use client";

import { useEffect, useMemo, useState } from "react";
import { Car, Landmark, MapPinned, Utensils } from "lucide-react";
import type {
  LocalAppCategory,
  LocalCityApps,
  LocalAppsTripOption,
} from "@/app/app/local-apps/_lib/types";
import {
  loadCityCache,
  normalizeCityFromDestination,
  resolveCityApps,
  saveCityCache,
  tripIsActive,
} from "@/app/app/local-apps/_lib/local-apps-helpers";

const CATEGORY_ORDER: LocalAppCategory[] = ["Transport", "Food", "Payments", "Navigation"];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function AppCategoryIcon({ category }: { category: LocalAppCategory }) {
  const common = "h-4 w-4";
  if (category === "Transport") return <Car className={common} aria-hidden />;
  if (category === "Food") return <Utensils className={common} aria-hidden />;
  if (category === "Payments") return <Landmark className={common} aria-hidden />;
  return <MapPinned className={common} aria-hidden />;
}

type Props = {
  trips: LocalAppsTripOption[];
  initialTripId: string;
};

export default function LocalAppsClient({ trips, initialTripId }: Props) {
  const [selectedTripId, setSelectedTripId] = useState(initialTripId || trips[0]?.id || "");
  const [loading, setLoading] = useState(true);
  const [switchingTrip, setSwitchingTrip] = useState(false);
  const [cityApps, setCityApps] = useState<LocalCityApps | null>(null);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? trips[0] ?? null,
    [selectedTripId, trips],
  );

  const cityKey = normalizeCityFromDestination(selectedTrip?.destination ?? "");
  const destinationCacheKey = selectedTrip
    ? `${cityKey}|${selectedTrip.destination.trim().toLowerCase()}`
    : cityKey;

  useEffect(() => {
    if (!selectedTrip) return;
    setLoading(true);
    setCityApps(null);
    setSwitchingTrip(true);

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;

      // Offline-first: cache -> then refresh from bundled source.
      const cached = loadCityCache(destinationCacheKey);
      if (cached) {
        setCityApps(cached);
        setLoading(false);
      }

      const next = resolveCityApps(selectedTrip.destination);
      setCityApps(next);
      saveCityCache(destinationCacheKey, next);
      setLoading(false);
      setSwitchingTrip(false);
    }, 140);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setSwitchingTrip(false);
    };
  }, [destinationCacheKey, selectedTrip]);

  const isArrivalContext = selectedTrip
    ? tripIsActive(selectedTrip.startDate, selectedTrip.endDate)
    : false;

  return (
    <main className="min-h-screen bg-slate-50 pb-[calc(var(--travel-os-bottom-nav-h)+5rem)]">
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-8 pt-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Trip destination
          </label>
          <select
            value={selectedTripId}
            onChange={(e) => {
              setSwitchingTrip(true);
              setSelectedTripId(e.target.value);
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          >
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.title} · {trip.destination}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Cached for offline use • city profile auto-loads from your selected trip.
          </p>
          {switchingTrip ? (
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
              Refreshing apps...
            </div>
          ) : null}
        </section>

        {selectedTrip && isArrivalContext ? (
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3.5 py-3 shadow-sm">
            <p className="text-sm font-semibold text-indigo-800">
              Install these apps for {cityApps?.city ?? selectedTrip.destination}
            </p>
          </section>
        ) : null}

        {loading || !cityApps ? (
          <section className="space-y-2">
            <div className="h-20 animate-pulse rounded-2xl bg-white" />
            <div className="h-20 animate-pulse rounded-2xl bg-white" />
            <div className="h-20 animate-pulse rounded-2xl bg-white" />
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">
                Apps for {cityApps.city}, {cityApps.country}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Last updated {formatDateTime(cityApps.lastUpdatedIso)}
              </p>
              {cityApps.mustHave.length > 0 ? (
                <p className="mt-2 text-xs text-indigo-700">
                  Must-have: {cityApps.mustHave.join(" • ")}
                </p>
              ) : null}
            </section>

            {CATEGORY_ORDER.map((category) => {
              const apps = cityApps.categories[category] ?? [];
              return (
                <section key={category} className="space-y-2">
                  <h2 className="text-sm font-semibold text-slate-900">{category}</h2>
                  {apps.map((app) => {
                    return (
                      <article
                        key={app.id}
                        className={`rounded-2xl border bg-white p-3.5 shadow-sm ${
                          app.mostUseful ? "border-indigo-200" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                              <AppCategoryIcon category={app.category} />
                            </span>
                            <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{app.name}</p>
                            {app.mostUseful ? (
                              <p className="mt-1 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                Most useful
                              </p>
                            ) : null}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <a
                              href={app.playStoreUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white"
                            >
                              Install
                            </a>
                          </div>
                        </div>

                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                          {app.shortTips.slice(0, 3).map((tip) => (
                            <li key={tip}>{tip}</li>
                          ))}
                        </ul>
                      </article>
                    );
                  })}
                </section>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
