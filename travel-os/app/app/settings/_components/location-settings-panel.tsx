"use client";

import { useUserLocation } from "@/app/app/_components/user-location-provider";
import { formatLocationLabel } from "@/lib/location";
import { LoaderCircle, MapPinned, Navigation, RefreshCw } from "lucide-react";
import { useState } from "react";

/**
 * Settings → Location controls.
 * Manual entry overrides GPS until the user refreshes with GPS.
 */
export default function LocationSettingsPanel() {
  const {
    location,
    permission,
    busy,
    promptContext,
    refreshLocation,
    setLocationEnabled,
    setManualLocation,
    clearLocation,
    allowLocation,
  } = useUserLocation();

  const [manualQuery, setManualQuery] = useState("");
  const enabled = location?.enabled !== false && Boolean(promptContext);
  const hasCoords = Boolean(location);

  const onManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuery.trim() || busy) return;
    await setManualLocation(manualQuery.trim());
    setManualQuery("");
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
          <MapPinned className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Location
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Used to personalize nearby suggestions in chat. Exact coordinates stay private.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">
          Current location
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">
          {formatLocationLabel(location)}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {location
            ? `Source: ${location.source === "manual" ? "Manual" : location.source === "profile" ? "Saved profile" : "GPS"}${
                location.lastUpdated
                  ? ` · Updated ${new Date(location.lastUpdated).toLocaleString()}`
                  : ""
              }${location.enabled === false ? " · Disabled for AI" : ""}`
            : permission === "denied"
              ? "Permission denied in the browser. You can set a city manually below."
              : permission === "dismissed"
                ? "You skipped location earlier. Enable anytime below."
                : "Not set yet"}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!hasCoords || permission === "unknown" || permission === "dismissed" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void allowLocation()}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Navigation className="h-4 w-4" aria-hidden />
            )}
            Enable location
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void refreshLocation({ force: true })}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Refresh GPS
          </button>
        )}

        {hasCoords ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void setLocationEnabled(!enabled)}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            {enabled ? "Disable for AI" : "Enable for AI"}
          </button>
        ) : null}

        {hasCoords ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void clearLocation()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-800 disabled:opacity-50"
          >
            Clear
          </button>
        ) : null}
      </div>

      <form onSubmit={(e) => void onManualSubmit(e)} className="mt-5 space-y-2">
        <label htmlFor="manual-location" className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Change location manually
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="manual-location"
            type="text"
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            placeholder="e.g. Tokyo, Japan"
            disabled={busy}
            className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none ring-slate-900/10 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !manualQuery.trim()}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Set
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Manual location overrides GPS until you tap Refresh GPS.
        </p>
      </form>
    </section>
  );
}
