"use client";

import { MapPin, X } from "lucide-react";

type LocationPermissionDialogProps = {
  open: boolean;
  busy?: boolean;
  onAllow: () => void;
  onNotNow: () => void;
};

/**
 * Friendly one-time location permission dialog.
 * Choice is remembered — do not show again after Allow / Not Now.
 */
export default function LocationPermissionDialog({
  open,
  busy,
  onAllow,
  onNotNow,
}: LocationPermissionDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss"
        disabled={busy}
        onClick={onNotNow}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-permission-title"
        className="relative z-[1] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
            <MapPin className="h-5 w-5" aria-hidden />
          </div>
          <button
            type="button"
            onClick={onNotNow}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2
          id="location-permission-title"
          className="mt-3 text-base font-semibold text-slate-900"
        >
          Personalize with your location
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-600">
          Allow location access so we can recommend nearby destinations, restaurants,
          attractions and personalize your travel experience.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          We only use city-level context with AI — never share exact coordinates in chat.
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onNotNow}
            disabled={busy}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={onAllow}
            disabled={busy}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Getting location…" : "Allow Location"}
          </button>
        </div>
      </div>
    </div>
  );
}
