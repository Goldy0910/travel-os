"use client";

import { useFormActionFeedback } from "@/app/app/_components/use-form-action-feedback";
import { MoreVertical } from "lucide-react";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { deleteTripAction } from "../data-actions";

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

type Props = {
  tripId: string;
  canDeleteTrip?: boolean;
  onEditTrip: () => void;
  /** `hero` = card on itinerary workspace; `banner` = classic dark header */
  variant?: "hero" | "banner";
};

export default function TripManageMenu({
  tripId,
  canDeleteTrip = false,
  onEditTrip,
  variant = "hero",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { pending: deleteTripPending, runAction: runDeleteTrip } = useFormActionFeedback();

  useDismissOnOutsideClick(open, () => setOpen(false), wrapRef);

  const triggerClass =
    variant === "banner"
      ? "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 touch-manipulation"
      : "inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2";

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        <span className="sr-only">Trip options</span>
        <MoreVertical className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
        >
          <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 touch-manipulation"
            onClick={() => {
              setOpen(false);
              onEditTrip();
            }}
          >
            Edit trip
          </button>
          {canDeleteTrip ? (
            <button
              type="button"
              role="menuitem"
              disabled={deleteTripPending}
              className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 touch-manipulation"
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
