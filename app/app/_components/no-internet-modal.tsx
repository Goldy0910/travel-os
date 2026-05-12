"use client";

import { useEffect, useState } from "react";

const OFFLINE_EVENT = "travel-os-no-internet";

export function showNoInternetModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENT));
}

export default function NoInternetModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOfflineEvent = () => setOpen(true);
    const onOffline = () => setOpen(true);
    window.addEventListener(OFFLINE_EVENT, onOfflineEvent as EventListener);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener(OFFLINE_EVENT, onOfflineEvent as EventListener);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/45 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h2 className="text-base font-semibold text-slate-900">No internet connection</h2>
        <p className="mt-2 text-sm text-slate-600">
          You appear to be offline. Please check your network and try again.
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          OK
        </button>
      </div>
    </div>
  );
}
