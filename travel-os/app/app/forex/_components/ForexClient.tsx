"use client";

import BottomSheetModal from "@/app/app/_components/bottom-sheet-modal";
import ButtonSpinner from "@/app/app/_components/button-spinner";
import { Info, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ForexPlace, ForexRateResponse, TripForexOption } from "@/app/app/forex/_lib/types";
import {
  convertToInr,
  effectiveRate,
  hoursAgoLabel,
  recommendationText,
} from "@/app/app/forex/_lib/calculations";
import { loadRateCache, saveRateCache } from "@/app/app/forex/_lib/storage";
import { currencyForPlace, inferCountryFromPlace } from "@/app/app/forex/_lib/geo-currency";
import { resolveDestination } from "@/app/app/_lib/destination-intel";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "SGD", "JPY", "THB", "AUD", "CAD"];

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

/** Lowest effective INR per unit of FX is best for the traveler. */
function bestEffectiveChannel(
  atm: number,
  airport: number,
  local: number,
): "atm" | "airport" | "local" | null {
  const pairs = [
    { key: "atm" as const, rate: atm },
    { key: "airport" as const, rate: airport },
    { key: "local" as const, rate: local },
  ].filter((p) => p.rate > 0);
  if (pairs.length === 0) return null;
  let best = pairs[0]!;
  for (const p of pairs) {
    if (p.rate < best.rate) best = p;
  }
  return best.key;
}

export default function ForexClient({ trips, initialTripId }: Props) {
  const router = useRouter();
  const initialTrip =
    trips.find((t) => t.id === (initialTripId || trips[0]?.id)) ?? trips[0] ?? null;
  const [currency, setCurrency] = useState(() =>
    currencyForPlace(initialTrip?.destination ?? ""),
  );
  const [rate, setRate] = useState<ForexRateResponse | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  const [amount, setAmount] = useState("100");
  const [atmFlatFee, setAtmFlatFee] = useState("0");

  const [selectedTripId, setSelectedTripId] = useState(initialTripId || trips[0]?.id || "");

  const [placesKind, setPlacesKind] = useState<"atm" | "exchange">("atm");
  const [placesLoading, setPlacesLoading] = useState(false);
  const [places, setPlaces] = useState<ForexPlace[]>([]);
  const [placesView, setPlacesView] = useState<"list" | "map">("list");
  const [mapIframeLoading, setMapIframeLoading] = useState(false);
  const [saveAsExpenseOpening, setSaveAsExpenseOpening] = useState(false);

  const [rateCardMenuOpen, setRateCardMenuOpen] = useState(false);
  const [atmFeeSheetOpen, setAtmFeeSheetOpen] = useState(false);
  const rateCardMenuRef = useRef<HTMLDivElement>(null);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? trips[0] ?? null,
    [selectedTripId, trips],
  );
  const destinationLabel = selectedTrip?.destination || "your destination";
  const destinationIntel = resolveDestination(destinationLabel);
  const destinationCountry = selectedTrip ? inferCountryFromPlace(selectedTrip.destination) : "";

  const mapEmbedSrc = useMemo(() => {
    const q = `${placesKind === "atm" ? "ATM" : "Currency exchange"} near ${destinationIntel.searchQuery || destinationLabel}`;
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  }, [placesKind, destinationIntel.searchQuery, destinationLabel]);

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

  const bestChannel = useMemo(
    () => bestEffectiveChannel(atmRate, airportRate, localRate),
    [atmRate, airportRate, localRate],
  );

  const convertedInr = convertToInr(numericAmount, baseRate);

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

  useEffect(() => {
    if (!rateCardMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rateCardMenuRef.current && !rateCardMenuRef.current.contains(e.target as Node)) {
        setRateCardMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [rateCardMenuOpen]);

  const onSaveAsExpense = () => {
    if (!numericAmount || !baseRate) {
      toast.error("Add amount and valid rate first.");
      return;
    }
    if (!selectedTripId || selectedTripId === "local") {
      toast.error("Select one of your trips to save this expense.");
      return;
    }
    const inrRounded = Math.round(convertedInr * 100) / 100;
    const qs = new URLSearchParams({
      tab: "expenses",
      quickAction: "expense",
      prefillExpenseInr: String(inrRounded),
    });
    setSaveAsExpenseOpening(true);
    router.push(`/app/trip/${encodeURIComponent(selectedTripId)}?${qs.toString()}`);
  };

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

  useEffect(() => {
    if (placesView !== "map") return;
    if (placesLoading) return;
    setMapIframeLoading(true);
  }, [placesView, placesLoading, mapEmbedSrc]);

  useEffect(() => {
    if (!mapIframeLoading) return;
    const id = window.setTimeout(() => setMapIframeLoading(false), 25000);
    return () => window.clearTimeout(id);
  }, [mapIframeLoading]);

  const switchPlacesKind = (kind: "atm" | "exchange") => {
    if (kind === placesKind) return;
    setPlacesKind(kind);
    setPlacesLoading(true);
    setPlaces([]);
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-[calc(var(--travel-os-bottom-nav-h)+5rem)]">
      <div className="mx-auto w-full max-w-md space-y-3 px-4 pb-8 pt-3">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-labelledby="forex-expense-rates-heading">
          <h2 id="forex-expense-rates-heading" className="mb-2 text-sm font-semibold text-slate-900">
            Exchange Rate
          </h2>

          {rateLoading ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-2">
                <div className="h-10 w-20 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-6 w-6 animate-pulse rounded bg-slate-100" />
                <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <div className="h-2.5 w-32 animate-pulse rounded bg-slate-100" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="h-[4.5rem] animate-pulse rounded-lg bg-slate-100" />
                <div className="h-[4.5rem] animate-pulse rounded-lg bg-slate-100" />
                <div className="h-[4.5rem] animate-pulse rounded-lg bg-slate-100" />
              </div>
              <div className="h-12 animate-pulse rounded-lg bg-sky-50" />
            </div>
          ) : rate ? (
            <>
              <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                <label className="sr-only" htmlFor="forex-currency-select">
                  Currency
                </label>
                <select
                  id="forex-currency-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="min-h-11 min-w-[4.25rem] touch-manipulation rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                <span className="text-base font-medium text-slate-400" aria-hidden>
                  =
                </span>
                <p className="min-w-0 truncate text-lg font-bold tabular-nums tracking-tight text-slate-900">
                  {formatInr(rate.rateToInr)}
                </p>
              <div ref={rateCardMenuRef} className="relative shrink-0 justify-self-end">
                    <button
                      type="button"
                      aria-expanded={rateCardMenuOpen}
                      aria-haspopup="menu"
                      aria-label="Exchange rate options"
                      onClick={() => setRateCardMenuOpen((v) => !v)}
                      className="grid h-11 min-h-11 min-w-11 touch-manipulation place-items-center rounded-xl border border-transparent text-slate-600 transition hover:bg-slate-50 active:bg-slate-100"
                    >
                      <MoreVertical className="h-5 w-5" aria-hidden />
                    </button>
                    {rateCardMenuOpen ? (
                      <div
                        role="menu"
                        className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                          onClick={() => {
                            setRateCardMenuOpen(false);
                            setAtmFeeSheetOpen(true);
                          }}
                        >
                          Add ATM fee
                        </button>
                      </div>
                    ) : null}
              </div>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Effective
                  {flatFee > 0 ? (
                    <span className="font-normal normal-case text-slate-400">
                      {" "}
                      · Fee {formatInr(flatFee)}
                    </span>
                  ) : null}
                </p>
                <p className="text-[10px] text-slate-400">Updated {hoursAgoLabel(rate.lastUpdatedIso)}</p>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {(
                  [
                    { key: "atm" as const, label: "ATM", value: atmRate },
                    { key: "airport" as const, label: "Airport", value: airportRate },
                    { key: "local" as const, label: "Local", value: localRate },
                  ] as const
                ).map(({ key, label, value }) => {
                  const isBest = bestChannel === key && value > 0;
                  return (
                    <div
                      key={key}
                      className={`flex min-h-[4.75rem] flex-col items-center justify-between rounded-lg px-1 py-2 text-center transition ${
                        isBest
                          ? "border-2 border-emerald-400 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-100"
                          : "border border-stone-200/90 bg-[#faf6f0]"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`text-[9px] font-semibold uppercase tracking-wide ${isBest ? "text-emerald-700" : "text-slate-500"}`}
                        >
                          {label}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-wide ${
                            isBest ? "bg-emerald-100 text-emerald-800" : "invisible text-transparent"
                          }`}
                          aria-hidden={!isBest}
                        >
                          Best
                        </span>
                      </div>
                      <span className="text-sm font-bold tabular-nums leading-none text-slate-900">
                        {formatInr(value)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex gap-2 rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-2">
                <Info className="mt-px h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                <p className="text-xs leading-snug text-sky-950">{recommendationText({ atmRate, airportRate, localRate })}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">Rate unavailable.</p>
          )}
        </section>

        <BottomSheetModal
          open={atmFeeSheetOpen}
          onClose={() => setAtmFeeSheetOpen(false)}
          title="ATM flat fee"
          description="Optional flat fee in INR per ATM withdrawal. Used to estimate your ATM effective rate."
          panelClassName="max-h-[55vh]"
        >
          <label htmlFor="atm-flat-fee" className="block text-xs font-medium text-slate-600">
            Fee (INR)
          </label>
          <input
            id="atm-flat-fee"
            inputMode="decimal"
            value={atmFlatFee}
            onChange={(e) => setAtmFlatFee(e.target.value)}
            placeholder="0"
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => setAtmFeeSheetOpen(false)}
            className="mt-4 min-h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Done
          </button>
        </BottomSheetModal>

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
            disabled={saveAsExpenseOpening}
            aria-busy={saveAsExpenseOpening}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-90"
          >
            {saveAsExpenseOpening ? (
              <>
                <ButtonSpinner className="h-5 w-5 shrink-0 text-white" />
                Opening expense…
              </>
            ) : (
              "Save as expense"
            )}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Nearby options</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => switchPlacesKind("atm")}
                className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${
                  placesKind === "atm" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                ATM
              </button>
              <button
                type="button"
                onClick={() => switchPlacesKind("exchange")}
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
              onClick={() => {
                setPlacesView("list");
                setMapIframeLoading(false);
              }}
              className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${
                placesView === "list" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => {
                setPlacesView("map");
                setMapIframeLoading(true);
              }}
              className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${
                placesView === "map" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
              }`}
            >
              Map
            </button>
          </div>

          {placesLoading ? (
            <div
              className="mt-3 flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-10"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <ButtonSpinner className="h-8 w-8 text-indigo-600" />
              <p className="text-center text-sm font-medium text-slate-600">
                {placesKind === "atm" ? "Loading ATM locations…" : "Loading exchange locations…"}
              </p>
              <p className="text-center text-xs text-slate-500">This may take a few seconds.</p>
            </div>
          ) : placesView === "map" ? (
            <div className="relative mt-3 overflow-hidden rounded-xl border border-slate-200">
              {mapIframeLoading ? (
                <div
                  className="absolute inset-0 z-10 flex min-h-56 flex-col items-center justify-center gap-2 bg-white/95 px-4 backdrop-blur-[1px]"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <ButtonSpinner className="h-8 w-8 text-indigo-600" />
                  <p className="text-center text-sm font-medium text-slate-600">Loading map…</p>
                  <p className="text-center text-xs text-slate-500">Hang tight while the map loads.</p>
                </div>
              ) : null}
              <iframe
                key={mapEmbedSrc}
                title="forex-map"
                src={mapEmbedSrc}
                onLoad={() => setMapIframeLoading(false)}
                className="relative z-0 h-56 w-full bg-slate-100"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <div className="mt-3 max-h-64 overflow-y-auto overscroll-y-contain rounded-xl border border-slate-100 bg-slate-50/50 pr-1 touch-pan-y [-webkit-overflow-scrolling:touch]">
              <ul className="space-y-2 p-1">
                {places.length === 0 ? (
                  <li className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                    No places found.
                  </li>
                ) : (
                  places.map((place) => (
                    <li
                      key={place.id || `${place.name}-${place.address}`}
                      className="rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100"
                    >
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
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
