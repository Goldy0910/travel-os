"use client";

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
            href={`/app/trip/${tripId}`}
            role="menuitem"
            className="min-h-11 whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Add activity
          </Link>
          <Link
            href={`/app/trip/${tripId}/expenses`}
            role="menuitem"
            className="min-h-11 whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Add expense
          </Link>
          <Link
            href={`/app/trip/${tripId}/docs`}
            role="menuitem"
            className="min-h-11 whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Upload doc
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
