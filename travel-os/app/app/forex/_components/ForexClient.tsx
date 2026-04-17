"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  ForexPlace,
  ForexRateResponse,
  ForexTransaction,
  TripForexOption,
} from "@/app/app/forex/_lib/types";
import {
  convertToInr,
  effectiveRate,
  hoursAgoLabel,
  recommendationText,
  tipAmountLocal,
} from "@/app/app/forex/_lib/calculations";
import { loadRateCache, loadTransactions, saveRateCache, saveTransactions } from "@/app/app/forex/_lib/storage";
import { currencyForPlace, inferCountryFromPlace } from "@/app/app/forex/_lib/geo-currency";
import { resolveDestination } from "@/app/app/_lib/destination-intel";

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SGD", "JPY", "THB", "AUD", "CAD"];

type Props = {
  trips: TripForexOption[];
  initialTripId: string;
};

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ForexClient({ trips, initialTripId }: Props) {
  const [currency, setCurrency] = useState("USD");
  const [rate, setRate] = useState<ForexRateResponse | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  const [amount, setAmount] = useState("100");
  const [atmFlatFee, setAtmFlatFee] = useState("0");

  const [transactions, setTransactions] = useState<ForexTransaction[]>([]);
  const [selectedTripId, setSelectedTripId] = useState(initialTripId || trips[0]?.id || "");

  const [tipBill, setTipBill] = useState("100");
  const [tipPercent, setTipPercent] = useState(10);

  const [placesKind, setPlacesKind] = useState<"atm" | "exchange">("atm");
  const [placesLoading, setPlacesLoading] = useState(false);
  const [places, setPlaces] = useState<ForexPlace[]>([]);
  const [placesView, setPlacesView] = useState<"list" | "map">("list");

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? trips[0] ?? null,
    [selectedTripId, trips],
  );
  const destinationLabel = selectedTrip?.destination || "your destination";
  const destinationIntel = resolveDestination(destinationLabel);
  const destinationCountry = selectedTrip ? inferCountryFromPlace(selectedTrip.destination) : "";

  useEffect(() => {
    if (!selectedTrip) return;
    const inferred = currencyForPlace(selectedTrip.destination);
    setCurrency(inferred);
  }, [selectedTrip]);

  const numericAmount = Number(amount) || 0;
  const baseRate = rate?.rateToInr ?? 0;
  const flatFee = Number(atmFlatFee) || 0;

  const atmRate = effectiveRate(baseRate, 3, flatFee, numericAmount);
  const airportRate = effectiveRate(baseRate, 8, 0, numericAmount);
  const localRate = effectiveRate(baseRate, 2, 0, numericAmount);

  const convertedInr = convertToInr(numericAmount, baseRate);
  const tipLocal = tipAmountLocal(Number(tipBill) || 0, tipPercent);
  const tipInr = convertToInr(tipLocal, baseRate);

  useEffect(() => {
    setTransactions(loadTransactions());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = loadRateCache(currency);
    if (cached) {
      setRate(cached);
    }

    const fetchRates = async () => {
      setRateLoading(true);
      try {
        const response = await fetch(`/app/forex/api/rates?currency=${encodeURIComponent(currency)}`);
        if (!response.ok) throw new Error("Rate request failed");
        const data = (await response.json()) as ForexRateResponse;
        if (cancelled) return;
        setRate(data);
        saveRateCache(currency, data);
      } catch {
        if (!cancelled && !cached) {
          toast.error("Could not load live rates. Showing fallback.");
        }
      } finally {
        if (!cancelled) setRateLoading(false);
      }
    };
    void fetchRates();
    return () => {
      cancelled = true;
    };
  }, [currency]);

  const onSaveAsExpense = () => {
    if (!numericAmount || !baseRate) {
      toast.error("Add amount and valid rate first.");
      return;
    }
    const next: ForexTransaction = {
      id: crypto.randomUUID(),
      amount: numericAmount,
      currency,
      inr: convertedInr,
      createdAtIso: new Date().toISOString(),
    };
    const updated = [next, ...transactions].slice(0, 100);
    setTransactions(updated);
    saveTransactions(updated);
    toast.success("Saved as expense.");
  };

  const totalSpendInr = transactions.reduce((sum, row) => sum + row.inr, 0);

  const loadPlaces = async () => {
    setPlacesLoading(true);
    try {
      const response = await fetch("/app/forex/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destinationIntel.searchQuery || destinationLabel,
          kind: placesKind,
        }),
      });
      if (!response.ok) throw new Error("Places failed");
      const data = (await response.json()) as { places?: ForexPlace[] };
      setPlaces(data.places ?? []);
    } catch {
      setPlaces([]);
      toast.error("Could not load nearby places.");
    } finally {
      setPlacesLoading(false);
    }
  };

  useEffect(() => {
    if (!destinationLabel) return;
    void loadPlaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationLabel, placesKind]);

  return (
    <main className="min-h-screen bg-slate-50 pb-[calc(var(--travel-os-bottom-nav-h)+5rem)]">
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-8 pt-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trip</p>
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
          {destinationCountry ? (
            <p className="mt-2 text-xs text-slate-500">
              Detected country: <span className="font-semibold capitalize text-slate-700">{destinationCountry}</span>
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Exchange rates</p>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          {rateLoading ? (
            <div className="mt-3 h-16 animate-pulse rounded-xl bg-slate-100" />
          ) : rate ? (
            <>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                1 {currency} = {formatInr(rate.rateToInr)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Last updated {hoursAgoLabel(rate.lastUpdatedIso)} · {rate.source === "live" ? "Live" : "Cached/Fallback"}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Rate unavailable.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Fee comparison</p>
          <label className="mt-3 block text-xs font-medium text-slate-600">ATM flat fee (INR, optional)</label>
          <input
            inputMode="decimal"
            value={atmFlatFee}
            onChange={(e) => setAtmFlatFee(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
          <div className="mt-3 grid grid-cols-1 gap-2">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">ATM effective rate: <strong>{formatInr(atmRate)}</strong></div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm">Airport exchange rate: <strong>{formatInr(airportRate)}</strong></div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm">Local exchange rate: <strong>{formatInr(localRate)}</strong></div>
          </div>
          <p className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
            {recommendationText({ atmRate, airportRate, localRate })}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Convert currency</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              placeholder="Amount"
            />
            <input
              value={currency}
              readOnly
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
            />
          </div>
          <p className="mt-3 text-sm text-slate-700">
            INR equivalent: <strong>{formatInr(convertedInr)}</strong>
          </p>
          <button
            type="button"
            onClick={onSaveAsExpense}
            className="mt-3 min-h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Save as expense
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Expense tracking</p>
            <p className="text-sm font-semibold text-slate-900">{formatInr(totalSpendInr)}</p>
          </div>
          <p className="text-xs text-slate-500">Total spend in INR</p>
          <ul className="mt-3 space-y-2">
            {transactions.length === 0 ? (
              <li className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">No forex expenses yet.</li>
            ) : (
              transactions.slice(0, 8).map((txn) => (
                <li key={txn.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-900">
                    {txn.amount} {txn.currency} → {formatInr(txn.inr)}
                  </p>
                  <p className="text-xs text-slate-500">{new Date(txn.createdAtIso).toLocaleString()}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Tip calculator</p>
          <input
            inputMode="decimal"
            value={tipBill}
            onChange={(e) => setTipBill(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            placeholder={`Bill amount (${currency})`}
          />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[5, 10, 15].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setTipPercent(pct)}
                className={`min-h-11 rounded-xl border text-sm font-semibold ${
                  tipPercent === pct
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-700">
            Tip: <strong>{tipLocal.toFixed(2)} {currency}</strong> · <strong>{formatInr(tipInr)}</strong>
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Nearby options</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPlacesKind("atm")}
                className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${
                  placesKind === "atm" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                ATM
              </button>
              <button
                type="button"
                onClick={() => setPlacesKind("exchange")}
                className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${
                  placesKind === "exchange" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Exchange
              </button>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setPlacesView("list")}
              className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${
                placesView === "list" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setPlacesView("map")}
              className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${
                placesView === "map" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
              }`}
            >
              Map
            </button>
          </div>

          {placesLoading ? (
            <div className="mt-3 h-24 animate-pulse rounded-xl bg-slate-100" />
          ) : placesView === "map" ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <iframe
                title="forex-map"
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  `${placesKind === "atm" ? "ATM" : "Currency exchange"} near ${destinationIntel.searchQuery || destinationLabel}`,
                )}&output=embed`}
                className="h-56 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {places.length === 0 ? (
                <li className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">No places found.</li>
              ) : (
                places.map((place) => (
                  <li key={place.id || `${place.name}-${place.address}`} className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-sm font-medium text-slate-900">{place.name}</p>
                    <p className="text-xs text-slate-500">{place.address}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        {place.rating ? `${place.rating.toFixed(1)} ★ (${place.userRatingCount})` : "No rating"}
                      </p>
                      {place.mapsUrl ? (
                        <a
                          href={place.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-indigo-700"
                        >
                          Open map
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
