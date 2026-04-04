"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  deleteItineraryItemAction,
  deleteTripAction,
  saveItineraryActivityAction,
} from "../data-actions";
import ActivityBottomSheet, { type ActivitySheetInitial } from "./activity-bottom-sheet";
import EntityCommentsBlock, {
  type EntityCommentDTO,
} from "./entity-comments-block";
import TripUpdateBottomSheet, {
  type TripEditDefaults,
} from "./trip-update-bottom-sheet";

const FALLBACK_TRIP_EDIT_DEFAULTS: TripEditDefaults = {
  title: "",
  location: "",
  startDate: "",
  endDate: "",
};

export type ItineraryItemDTO = {
  id: string;
  activity_name: string | null;
  title: string | null;
  location: string | null;
  time: string | null;
  date: string | null;
};

type TripItineraryShellProps = {
  tripId: string;
  tripTitle: string;
  dateRangeLabel: string;
  memberCount: number;
  canDeleteTrip: boolean;
  tripEditDefaults?: TripEditDefaults;
  orderedDates: string[];
  grouped: Record<string, ItineraryItemDTO[]>;
  initialError: string;
  defaultDateForAdd: string;
  activityCommentsByItemId: Record<string, EntityCommentDTO[]>;
  currentUserId: string;
  memberLabelByUserId: Record<string, string>;
};

function formatDateLabel(input: string) {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(input.trim());
  const d = iso ? new Date(`${input.trim()}T12:00:00`) : new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function IconDotsVertical({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

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

function TripHeaderMenu({
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

  useDismissOnOutsideClick(open, () => setOpen(false), wrapRef);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 active:bg-white/15"
      >
        <span className="sr-only">Trip options</span>
        <IconDotsVertical className="h-6 w-6" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-white/10 bg-slate-800 py-1 shadow-lg"
        >
          <Link
            href="/app/settings"
            role="menuitem"
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-white hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          {canDeleteTrip ? (
            <>
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
              <form
                action={deleteTripAction.bind(null, tripId)}
                onSubmit={(e) => {
                  if (
                    !window.confirm(
                      "Delete this trip permanently? This removes itinerary, expenses, documents, and members.",
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <button
                  type="submit"
                  role="menuitem"
                  className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-rose-200 hover:bg-white/10"
                >
                  Delete trip
                </button>
              </form>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ActivityRowMenu({
  tripId,
  item,
  onEdit,
}: {
  tripId: string;
  item: ItineraryItemDTO;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useDismissOnOutsideClick(open, () => setOpen(false), wrapRef);

  return (
    <div className="relative shrink-0 self-start" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        <span className="sr-only">Activity options</span>
        <IconDotsVertical />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 min-w-[9rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Update
          </button>
          <form
            action={deleteItineraryItemAction.bind(null, tripId, item.id)}
            onSubmit={(e) => {
              if (!window.confirm("Delete this activity? This cannot be undone.")) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              Delete
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function TripItineraryShell({
  tripId,
  tripTitle,
  dateRangeLabel,
  memberCount,
  canDeleteTrip,
  tripEditDefaults: tripEditDefaultsProp,
  orderedDates,
  grouped,
  initialError,
  defaultDateForAdd,
  activityCommentsByItemId,
  currentUserId,
  memberLabelByUserId,
}: TripItineraryShellProps) {
  const tripEditDefaults = tripEditDefaultsProp ?? FALLBACK_TRIP_EDIT_DEFAULTS;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tripUpdateOpen, setTripUpdateOpen] = useState(false);
  const [tripUpdateFormKey, setTripUpdateFormKey] = useState("trip-edit-0");
  const tripUpdateKeySeq = useRef(0);
  const [sheetInitial, setSheetInitial] = useState<ActivitySheetInitial>({
    activityName: "",
    location: "",
    time: "",
    date: defaultDateForAdd,
  });
  const [formKey, setFormKey] = useState("new-0");
  const formKeySeq = useRef(0);

  const saveAction = useCallback(
    (fd: FormData) => saveItineraryActivityAction(tripId, fd),
    [tripId],
  );

  const openAdd = () => {
    formKeySeq.current += 1;
    setSheetInitial({
      activityName: "",
      location: "",
      time: "",
      date: defaultDateForAdd,
    });
    setFormKey(`new-${formKeySeq.current}`);
    setSheetOpen(true);
  };

  const openEdit = (item: ItineraryItemDTO) => {
    const date =
      item.date ??
      (() => {
        for (const d of orderedDates) {
          const list = grouped[d];
          if (list?.some((i) => i.id === item.id)) return d;
        }
        return defaultDateForAdd;
      })();
    formKeySeq.current += 1;
    setSheetInitial({
      itemId: item.id,
      activityName: item.activity_name || item.title || "",
      location: item.location || "",
      time: item.time || "",
      date: date || defaultDateForAdd,
    });
    setFormKey(`edit-${item.id}-${formKeySeq.current}`);
    setSheetOpen(true);
  };

  const emptyState =
    orderedDates.length === 0 ? (
      <p className="mt-3 text-sm text-slate-600">
        No activities yet. Tap + to add your first one.
      </p>
    ) : null;

  return (
    <>
      <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold leading-tight">{tripTitle}</h1>
            <p className="mt-2 text-sm text-slate-300">{dateRangeLabel}</p>
            <p className="mt-2 text-sm text-slate-400">
              Shared with {memberCount} {memberCount === 1 ? "member" : "members"}
            </p>
          </div>
          <TripHeaderMenu
            tripId={tripId}
            canDeleteTrip={canDeleteTrip}
            onUpdateTrip={() => {
              tripUpdateKeySeq.current += 1;
              setTripUpdateFormKey(`trip-edit-${tripUpdateKeySeq.current}`);
              setTripUpdateOpen(true);
            }}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/app/trip/${tripId}/chat`}
            className="inline-flex min-h-11 items-center rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
          >
            Chat
          </Link>
          <Link
            href={`/app/trip/${tripId}/members`}
            className="inline-flex min-h-11 items-center rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
          >
            Members
          </Link>
          <Link
            href={`/app/trip/${tripId}/docs`}
            className="inline-flex min-h-11 items-center rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
          >
            Documents
          </Link>
          <Link
            href={`/app/trip/${tripId}/expenses`}
            className="inline-flex min-h-11 items-center rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
          >
            Expenses
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Itinerary</h2>

        {initialError ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{initialError}</p>
        ) : null}

        {emptyState}

        {orderedDates.length > 0 ? (
          <div className="mt-4 space-y-6">
            {orderedDates.map((date) => {
              const dateItems = grouped[date] ?? [];
              return (
                <div key={date} className="relative pl-6">
                  <div className="absolute bottom-0 left-2 top-1 w-px bg-slate-200" aria-hidden />
                  <div className="absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-slate-900 bg-white" />
                  <p className="text-sm font-semibold text-slate-900">{formatDateLabel(date)}</p>
                  <div className="mt-3 space-y-2">
                    {dateItems.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-500">
                        No activities planned for this day
                      </p>
                    ) : (
                      dateItems.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm"
                        >
                          <div className="flex gap-1">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900">
                                {item.activity_name || item.title || "Activity"}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">{item.location || "—"}</p>
                              {item.time ? (
                                <p className="mt-1 text-xs font-medium text-slate-500">{item.time}</p>
                              ) : null}
                            </div>
                            <ActivityRowMenu tripId={tripId} item={item} onEdit={() => openEdit(item)} />
                          </div>
                          <div className="mt-3 border-t border-slate-200/80 pt-3">
                            <EntityCommentsBlock
                              tripId={tripId}
                              entityType="activity"
                              entityId={item.id}
                              currentUserId={currentUserId}
                              initialComments={activityCommentsByItemId[item.id] ?? []}
                              memberLabelByUserId={memberLabelByUserId}
                            />
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <button
        type="button"
        onClick={openAdd}
        aria-label="Add activity"
        className="fixed bottom-6 right-6 z-[110] flex h-14 w-14 min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-900 text-2xl font-light leading-none text-white shadow-lg shadow-slate-900/30 transition hover:bg-slate-800 active:scale-95"
      >
        +
      </button>

      <ActivityBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initial={sheetInitial}
        formKey={formKey}
        saveAction={saveAction}
      />

      <TripUpdateBottomSheet
        open={tripUpdateOpen}
        onClose={() => setTripUpdateOpen(false)}
        tripId={tripId}
        defaults={tripEditDefaults}
        formKey={`${tripId}-${tripUpdateFormKey}`}
      />
    </>
  );
}
