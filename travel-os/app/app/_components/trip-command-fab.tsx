"use client";

import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function TripCommandFab({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="fixed bottom-[var(--travel-os-fab-bottom)] right-[max(1rem,env(safe-area-inset-right,0px))] z-[120] flex flex-col items-end gap-3"
    >
      {open ? (
        <div
          className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/15"
          role="menu"
        >
          <Link
            href={`/app/trip/${tripId}?tab=itinerary`}
            role="menuitem"
            className="flex min-h-11 items-center justify-between gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Add activity
            <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-700" />
          </Link>
          <Link
            href={`/app/trip/${tripId}?tab=expenses`}
            role="menuitem"
            className="flex min-h-11 items-center justify-between gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Add expense
            <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-700" />
          </Link>
          <Link
            href={`/app/trip/${tripId}?tab=docs`}
            role="menuitem"
            className="flex min-h-11 items-center justify-between gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Upload doc
            <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-700" />
          </Link>
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-slate-900 text-2xl font-light leading-none text-white shadow-lg shadow-slate-900/35 transition hover:bg-slate-800 active:scale-95"
      >
        {open ? "×" : "+"}
      </button>
    </div>
  );
}
