"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { COUNTRY_OPTIONS, findCountryByName } from "@/app/app/tools/visa2/_lib/countries";
import type {
  TripVisa2Option,
  VisaAlert,
  VisaAlertsResponse,
  VisaLookupResponse,
} from "@/app/app/tools/visa2/_lib/types";
import { useEffect, useMemo, useState } from "react";

const PASSPORT_STORAGE_KEY = "travel-os-visa2-passport-country";
const ALERT_CACHE_PREFIX = "travel-os-visa2-alerts-cache";
const CHECKLIST_PREFIX = "travel-os-visa2-checklist";

type TabKey = "guide" | "documents" | "alerts";

type Props = {
  trips: TripVisa2Option[];
  defaultTripId: string;
  defaultPassportCountry: string;
};

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Dates not set";
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

function compactTripOptionLabel(trip: TripVisa2Option): string {
  const title = trip.title.trim();
  const shortTitle = title.length > 24 ? `${title.slice(0, 24)}…` : title;
  return `${shortTitle} · ${trip.flagEmoji} · ${formatDateRange(trip.startDate, trip.endDate)}`;
}

function formatDate(inputIso: string): string {
  const d = new Date(inputIso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function applyByDate(startDate: string, processingDays: number): string {
  const start = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "N/A";
  const ms = start.getTime() - (processingDays + 7) * 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(ms));
}

function badgeTone(visaType: VisaLookupResponse["visaType"]): string {
  if (visaType === "Visa-free") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (visaType === "Visa on arrival") return "bg-sky-100 text-sky-800 border-sky-200";
  if (visaType === "eVisa") return "bg-indigo-100 text-indigo-800 border-indigo-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

function severityTone(severity: VisaAlert["severity"]): string {
  if (severity === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (severity === "warning") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function SectionLoading({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[120px] flex-col items-center justify-center gap-3 py-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <ButtonSpinner className="h-8 w-8 shrink-0 text-indigo-600" />
      <p className="max-w-[280px] text-center text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

export default function Visa2Client({ trips, defaultTripId, defaultPassportCountry }: Props) {
  const [tripId, setTripId] = useState(defaultTripId);
  const [passportCountry, setPassportCountry] = useState(defaultPassportCountry || "India");
  const [activeTab, setActiveTab] = useState<TabKey>("guide");
  const [lookup, setLookup] = useState<VisaLookupResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsData, setAlertsData] = useState<VisaAlertsResponse | null>(null);
  const [alertsError, setAlertsError] = useState("");
  const [lookupReloadSeed, setLookupReloadSeed] = useState(0);

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === tripId) ?? trips[0],
    [trips, tripId],
  );

  const checklistKey = `${CHECKLIST_PREFIX}:${tripId}:${passportCountry.toLowerCase()}`;
  const alertsCacheKey = `${ALERT_CACHE_PREFIX}:${tripId}:${passportCountry.toLowerCase()}`;

  const checklistReadyCount = useMemo(
    () => Object.values(checkedItems).filter(Boolean).length,
    [checkedItems],
  );

  useEffect(() => {
    const stored = localStorage.getItem(PASSPORT_STORAGE_KEY);
    if (stored && findCountryByName(stored)) {
      setPassportCountry(stored);
      return;
    }
    if (defaultPassportCountry) {
      setPassportCountry(defaultPassportCountry);
    }
  }, [defaultPassportCountry]);

  useEffect(() => {
    localStorage.setItem(PASSPORT_STORAGE_KEY, passportCountry);
  }, [passportCountry]);

  useEffect(() => {
    const saved = loadJson<Record<string, boolean>>(checklistKey, {});
    setCheckedItems(saved);
  }, [checklistKey]);

  useEffect(() => {
    if (!selectedTrip) return;
    let cancelled = false;
    const run = async () => {
      setLookupLoading(true);
      setLookupError("");
      try {
        const response = await fetch("/app/tools/visa2/api/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinationCountry: selectedTrip.destinationCountry,
            passportCountry,
          }),
        });
        if (!response.ok) {
          throw new Error("Lookup request failed");
        }
        const data = (await response.json()) as VisaLookupResponse;
        if (!cancelled) {
          setLookup(data);
          setLookupError("");
        }
      } catch {
        if (!cancelled) {
          setLookupError("Could not load visa info. Tap to retry.");
          setLookup(null);
        }
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [lookupReloadSeed, passportCountry, selectedTrip]);

  const loadAlerts = async (forceRefresh: boolean) => {
    if (!selectedTrip) return;
    if (!forceRefresh) {
      const cached = loadJson<{ refreshedAtIso: string; alerts: VisaAlert[] } | null>(alertsCacheKey, null);
      if (cached?.refreshedAtIso && cached.alerts) {
        const ageMs = Date.now() - new Date(cached.refreshedAtIso).getTime();
        if (ageMs <= 24 * 60 * 60 * 1000) {
          setAlertsData({ refreshedAtIso: cached.refreshedAtIso, alerts: cached.alerts });
          return;
        }
      }
    }

    setAlertsLoading(true);
    setAlertsError("");
    try {
      const response = await fetch("/app/tools/visa2/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationCountry: selectedTrip.destinationCountry,
          passportCountry,
        }),
      });
      if (!response.ok) {
        throw new Error("Alerts request failed");
      }
      const data = (await response.json()) as VisaAlertsResponse;
      setAlertsData(data);
      saveJson(alertsCacheKey, data);
    } catch {
      setAlertsError("Could not load visa info. Tap to retry.");
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "alerts") {
      void loadAlerts(false);
    }
  }, [activeTab, alertsCacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onToggleChecklist = (item: string) => {
    const next = { ...checkedItems, [item]: !checkedItems[item] };
    setCheckedItems(next);
    saveJson(checklistKey, next);
  };

  const tabButton = (key: TabKey, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(key)}
      className={`min-h-11 shrink-0 snap-start whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-semibold sm:text-sm ${
        activeTab === key ? "bg-slate-900 text-white" : "bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );

  if (!selectedTrip) {
    return <p className="text-sm text-slate-600">Create a trip first to use Visa.</p>;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 pb-[calc(var(--travel-os-bottom-nav-h)+5rem)]">
      <div className="mx-auto w-full max-w-[430px] space-y-3.5 px-4 pb-8 pt-3 md:max-w-2xl lg:max-w-4xl">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Trip
              </label>
              <select
                value={tripId}
                onChange={(e) => setTripId(e.target.value)}
                className="min-h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 sm:text-sm"
              >
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {compactTripOptionLabel(trip)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Passport country
              </label>
              <input
                list="visa2-country-list"
                value={passportCountry}
                onChange={(e) => setPassportCountry(e.target.value)}
                placeholder="Type country name"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 sm:text-sm"
              />
              <datalist id="visa2-country-list">
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.code} value={country.name} />
                ))}
              </datalist>
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
          aria-busy={lookupLoading}
        >
          {lookupLoading ? (
            <SectionLoading label="Loading visa summary…" />
          ) : lookupError ? (
            <button
              type="button"
              onClick={() => setLookupReloadSeed((v) => v + 1)}
              className="flex min-h-16 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-700"
            >
              {lookupError}
            </button>
          ) : !lookup ? (
            <button
              type="button"
              onClick={() => setLookupReloadSeed((v) => v + 1)}
              className="flex min-h-16 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-700"
            >
              Could not load visa info. Tap to retry.
            </button>
          ) : (
            <>
              <span
                className={`inline-flex min-h-8 w-fit items-center rounded-full border px-2.5 text-[11px] font-bold sm:px-3 sm:text-xs ${badgeTone(lookup.visaType)}`}
              >
                {lookup.visaType}
              </span>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] xl:grid-cols-4">
                <div className="min-w-0 rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Processing</p><p className="truncate font-semibold leading-5 text-slate-900">{lookup.processingTime}</p></div>
                <div className="min-w-0 rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Fee</p><p className="truncate font-semibold leading-5 text-slate-900">{lookup.fee}</p></div>
                <div className="min-w-0 rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Validity</p><p className="truncate font-semibold leading-5 text-slate-900">{lookup.validity}</p></div>
                <div className="min-w-0 rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Max stay</p><p className="truncate font-semibold leading-5 text-slate-900">{lookup.maxStay}</p></div>
              </div>

              <p className="mt-3 break-words text-sm text-slate-700">
                <span className="font-semibold">Apply by:</span>{" "}
                {applyByDate(selectedTrip.startDate, lookup.processingDays)}
              </p>
              <a
                href={lookup.applyLink}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-center text-[13px] font-semibold text-white md:w-auto md:text-sm"
              >
                Open official apply link
              </a>
            </>
          )}
        </section>

        <section className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] snap-x snap-mandatory touch-pan-x [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2 pb-1">
          {tabButton("guide", "Application Guide")}
          {tabButton("documents", `Documents ${lookup ? `(${checklistReadyCount}/${lookup.documents.length})` : ""}`)}
          {tabButton("alerts", "Entry Alerts")}
          </div>
        </section>

        {activeTab === "guide" ? (
          <section className="space-y-2.5" aria-busy={lookupLoading}>
            {lookupError ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setLookupReloadSeed((v) => v + 1)}
                  className="flex min-h-16 w-full items-center justify-center rounded-xl px-4 text-center text-sm font-medium text-slate-700"
                >
                  {lookupError}
                </button>
              </div>
            ) : lookupLoading || !lookup ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <SectionLoading label="Loading application guide…" />
              </div>
            ) : (
              lookup.guideSteps.map((step, index) => (
                <article key={step} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Step {index + 1}</p>
                  <p className="mt-1 break-words text-[13px] leading-5 text-slate-800 sm:text-sm">{step}</p>
                </article>
              ))
            )}
          </section>
        ) : null}

        {activeTab === "documents" ? (
          <section
            className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
            aria-busy={lookupLoading}
          >
            {lookupError ? (
              <button
                type="button"
                onClick={() => setLookupReloadSeed((v) => v + 1)}
                className="flex min-h-16 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-700"
              >
                {lookupError}
              </button>
            ) : lookupLoading || !lookup ? (
              <SectionLoading label="Loading document checklist…" />
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-900">
                  {checklistReadyCount} / {lookup.documents.length} ready
                </p>
                <div className="mt-3 space-y-2">
                  {lookup.documents.map((item) => (
                    <label key={item} className="flex min-h-11 items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-800 sm:text-sm">
                      <input
                        type="checkbox"
                        checked={!!checkedItems[item]}
                        onChange={() => onToggleChecklist(item)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                      />
                      <span className="break-words">{item}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : null}

        {activeTab === "alerts" ? (
          <section
            className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
            aria-busy={alertsLoading}
          >
            <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Last refreshed {alertsData && !alertsLoading ? formatDate(alertsData.refreshedAtIso) : "—"}
              </p>
              <button
                type="button"
                onClick={() => void loadAlerts(true)}
                disabled={alertsLoading}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:pointer-events-none disabled:opacity-60 md:w-auto"
              >
                {alertsLoading ? (
                  <>
                    <ButtonSpinner className="h-4 w-4 shrink-0 text-indigo-600" />
                    Refreshing…
                  </>
                ) : (
                  "Refresh"
                )}
              </button>
            </div>
            {alertsLoading ? (
              <SectionLoading label="Loading entry alerts…" />
            ) : alertsError ? (
              <button
                type="button"
                onClick={() => void loadAlerts(true)}
                className="mt-3 flex min-h-16 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-700"
              >
                {alertsError}
              </button>
            ) : (
              <div className="mt-3 space-y-2">
                {(alertsData?.alerts ?? []).map((alert) => (
                  <article
                    key={`${alert.title}-${alert.detail}`}
                    className={`rounded-xl border px-3 py-2 ${severityTone(alert.severity)}`}
                  >
                    <p className="text-sm font-semibold break-words">{alert.title}</p>
                    <p className="mt-1 text-xs break-words">{alert.detail}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
