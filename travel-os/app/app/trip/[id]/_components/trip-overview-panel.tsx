"use client";

import { useId, useRef, useState, useEffect, type RefObject } from "react";
import { useFormActionFeedback } from "@/app/app/_components/use-form-action-feedback";
import {
  deleteTripAction,
} from "../data-actions";
import TripUpdateBottomSheet, {
  type TripEditDefaults,
} from "./trip-update-bottom-sheet";

type TripOverviewPanelProps = {
  tripId: string;
  tripTitle: string;
  locationLabel: string;
  dateRangeLabel: string;
  memberCount: number;
  canDeleteTrip: boolean;
  tripEditDefaults: TripEditDefaults;
};

function useDismissOnOutsideClick(
  open: boolean,
  onClose: () => void,
  excludeRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (excludeRef?.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open, onClose, excludeRef]);
}

function IconDotsVerticalSmall({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="12" cy="6" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="18" r="1.8" />
    </svg>
  );
}

function TripManageMenu({
  tripId,
  canDeleteTrip,
  onUpdateTrip,
}: {
  tripId: string;
  canDeleteTrip: boolean;
  onUpdateTrip: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { pending: deleteTripPending, runAction: runDeleteTrip } = useFormActionFeedback();

  useDismissOnOutsideClick(open, () => setOpen(false), wrapRef);

  if (!canDeleteTrip) return null;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <span className="sr-only">Trip actions</span>
        <IconDotsVerticalSmall className="h-5 w-5" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-white/10 bg-slate-800 py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-white hover:bg-white/10"
            onClick={() => {
              setOpen(false);
              onUpdateTrip();
            }}
          >
            Update trip
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={deleteTripPending}
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-rose-200 hover:bg-white/10 disabled:opacity-50"
            onClick={() => {
              if (
                !window.confirm(
                  "Delete this trip permanently? This removes itinerary, expenses, documents, and members.",
                )
              ) {
                return;
              }
              setOpen(false);
              runDeleteTrip(() => deleteTripAction(tripId, new FormData()));
            }}
          >
            {deleteTripPending ? "Deleting…" : "Delete trip"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function TripOverviewPanel({
  tripId,
  tripTitle,
  locationLabel,
  dateRangeLabel,
  memberCount,
  canDeleteTrip,
  tripEditDefaults,
}: TripOverviewPanelProps) {
  const [tripUpdateOpen, setTripUpdateOpen] = useState(false);
  const [tripUpdateFormKey, setTripUpdateFormKey] = useState("trip-edit-0");
  const tripUpdateKeySeq = useRef(0);

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-[#1a2340] p-5 text-white shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight text-white">{tripTitle}</h1>
            {locationLabel ? (
              <p className="mt-2 text-sm text-white/70">{locationLabel}</p>
            ) : null}
            <p className={`text-sm text-white/70 ${locationLabel ? "mt-1" : "mt-2"}`}>
              {dateRangeLabel}
            </p>
            <p className="mt-1 text-sm text-white/55">
              {memberCount} member{memberCount === 1 ? "" : "s"}
            </p>
          </div>
          <TripManageMenu
            tripId={tripId}
            canDeleteTrip={canDeleteTrip}
            onUpdateTrip={() => {
              tripUpdateKeySeq.current += 1;
              setTripUpdateFormKey(`trip-edit-${tripUpdateKeySeq.current}`);
              setTripUpdateOpen(true);
            }}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Your trip hub</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Chat with your group, plan the itinerary, track expenses, share documents, and use Guide
          and Language tools — all from the tabs above.
        </p>
      </section>

      <TripUpdateBottomSheet
        key={tripUpdateFormKey}
        formKey={`${tripId}-${tripUpdateFormKey}`}
        open={tripUpdateOpen}
        onClose={() => setTripUpdateOpen(false)}
        tripId={tripId}
        defaults={tripEditDefaults}
      />
    </div>
  );
}
