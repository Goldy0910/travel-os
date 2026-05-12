"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadBundleCache,
  recommendPlan,
  resolveBundleFromDestination,
  saveBundleCache,
  savingsLabel,
} from "@/app/app/esim/_lib/esim-helpers";
import type { DurationDays, EsimTripOption, SimConnectivityBundle, UsageType } from "@/app/app/esim/_lib/types";
import { resolveDestination } from "@/app/app/_lib/destination-intel";

type Props = {
  trips: EsimTripOption[];
  initialTripId: string;
};

export default function EsimClient({ trips, initialTripId }: Props) {
  const [selectedTripId, setSelectedTripId] = useState(initialTripId || trips[0]?.id || "");
  const [duration, setDuration] = useState<DurationDays>(7);
  const [usage, setUsage] = useState<UsageType>("Medium");
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<SimConnectivityBundle | null>(null);
  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? trips[0] ?? null,
    [selectedTripId, trips],
  );
  const cacheKey = selectedTrip ? resolveDestination(selectedTrip.destination).cacheKey : "default";

  useEffect(() => {
    if (!selectedTrip) return;
    setLoading(true);
    const cached = loadBundleCache(cacheKey);
    if (cached) {
      setBundle(cached);
      setLoading(false);
    }
    const next = resolveBundleFromDestination(selectedTrip.destination);
    setBundle(next);
    saveBundleCache(cacheKey, next);
    setLoading(false);
  }, [cacheKey, selectedTrip]);

  const recommended = useMemo(
    () => (bundle ? recommendPlan({ bundle, duration, usage }) : null),
    [bundle, duration, usage],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-24 pt-4">
      <div className="mx-auto w-full max-w-md space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Trip destination
          </label>
          <select
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          >
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.title} · {trip.destination}
              </option>
            ))}
          </select>
        </section>

        {loading || !bundle ? (
          <section className="space-y-2">
            <div className="h-20 animate-pulse rounded-2xl bg-white" />
            <div className="h-20 animate-pulse rounded-2xl bg-white" />
            <div className="h-20 animate-pulse rounded-2xl bg-white" />
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">
                Destination SIM Guide · {bundle.city}, {bundle.country}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Updated {new Date(bundle.updatedAtIso).toLocaleString()}
              </p>
              <div className="mt-3 space-y-2">
                {bundle.topCarriers.map((carrier) => (
                  <article key={carrier.carrier} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{carrier.carrier}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          carrier.coverage === "Excellent"
                            ? "bg-emerald-100 text-emerald-700"
                            : carrier.coverage === "Good"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {carrier.coverage}
                      </span>
                    </div>
                    {carrier.bestOption ? (
                      <p className="mt-1 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                        Best Option
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Plan recommender</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) as DurationDays)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                >
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                </select>
                <select
                  value={usage}
                  onChange={(e) => setUsage(e.target.value as UsageType)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                >
                  <option value="Light">Light</option>
                  <option value="Medium">Medium</option>
                  <option value="Heavy">Heavy</option>
                </select>
              </div>
              {recommended ? (
                <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                  <p className="text-sm font-semibold text-indigo-800">
                    {recommended.carrier} · {recommended.plan.name}
                  </p>
                  <p className="mt-1 text-xs text-indigo-700">
                    {recommended.plan.data} · {recommended.plan.validityDays} days · Estimated INR {recommended.estimatedCostInr}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Price comparison</p>
              <div className="mt-2 space-y-2">
                {bundle.topCarriers.map((carrier) => (
                  <div key={`${carrier.carrier}-price`} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-900">{carrier.carrier}</p>
                    <p className="text-slate-600">Airport: INR {carrier.airportPriceInr} · City: INR {carrier.cityPriceInr}</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      {savingsLabel(carrier.airportPriceInr, carrier.cityPriceInr)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Carrier details</p>
              <div className="mt-2 space-y-3">
                {bundle.topCarriers.map((carrier) => (
                  <article key={`${carrier.carrier}-details`} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">{carrier.carrier}</p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {carrier.plans.map((plan) => (
                        <li key={plan.id}>
                          {plan.name}: {plan.data}, {plan.validityDays}d, INR {plan.priceInr}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-slate-500">
                      Recharge: {carrier.rechargeMethods.join(" • ")}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">eSIM options</p>
              <div className="mt-2 space-y-2">
                {bundle.esimProviders.slice(0, 2).map((provider) => (
                  <article key={provider.provider} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">{provider.provider}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {provider.data} · {provider.validityDays} days · INR {provider.priceInr}
                    </p>
                    <a
                      href={provider.purchaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white"
                    >
                      View plan
                    </a>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Smart insights</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                {bundle.smartInsights.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
