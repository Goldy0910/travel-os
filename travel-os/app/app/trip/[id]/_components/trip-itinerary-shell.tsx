"use client";

import { ChevronDown, MapPin } from "lucide-react";
import type { RefObject } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFormActionFeedback } from "@/app/app/_components/use-form-action-feedback";
import { useTripActiveTab } from "../_lib/trip-active-tab-context";
import { useTripFabRegistry } from "../_lib/trip-tab-fab-registry";
import {
  completeItinerarySetupManualAction,
  deleteItineraryItemAction,
  generateAiItineraryAction,
  importPdfItineraryAction,
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
import ItineraryCreationSetup from "./itinerary-creation-setup";
import ActivityDetailsNavLink from "./activity-details-nav-link";

const FALLBACK_TRIP_EDIT_DEFAULTS: TripEditDefaults = {
  title: "",
  location: "",
  startDate: "",
  endDate: "",
};
const QUICK_ACTION_EVENT = "travel-os-open-quick-action";

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
  autoOpenAddActivity?: boolean;
  /** Server-backed: false until AI / PDF import succeeds or user chooses manual. */
  itinerarySetupComplete?: boolean;
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

function formatDateLabelUpper(input: string) {
  return formatDateLabel(input).toUpperCase();
}

type ActivityVisual = {
  emoji: string;
  tags: string[];
  tileClass: string;
  tagClass: string;
};

function compactActivityTitle(activityName: string | null, title: string | null): string {
  const raw = (activityName || title || "Activity").trim();
  if (raw.length <= 60) return raw;
  return `${raw.slice(0, 57).trimEnd()}...`;
}

/** Display-only “type” from title/location — no DB field; avoids migrations. */
function inferActivityVisual(activityName: string | null, title: string | null, location: string | null): ActivityVisual {
  const raw = `${activityName ?? ""} ${title ?? ""} ${location ?? ""}`.toLowerCase();
  const food = /\b(dinner|lunch|breakfast|cafe|restaurant|food|eat|ivy|dining)\b/.test(raw);
  const sight = /\b(nature|view|sight|museum|hill|walk|explore|temple|park)\b/.test(raw);
  const adv = /\b(outdoor|outside|trek|bike|rental|adventure|zip|ski)\b/.test(raw);

  if (food) {
    const tags = ["Food"];
    if (/\b(group|family|friends|together)\b/.test(raw)) tags.push("Group");
    return {
      emoji: "🍽",
      tags: tags.slice(0, 3),
      tileClass: "bg-[#FAEEDA] text-[#633806]",
      tagClass: "bg-[#FAEEDA] text-[#633806]",
    };
  }
  if (sight) {
    const tags = ["Sightseeing"];
    if (/\b(nature|park|hill|view|trail)\b/.test(raw)) tags.push("Nature");
    return {
      emoji: "🧭",
      tags: tags.slice(0, 3),
      tileClass: "bg-[#EAF3DE] text-[#27500A]",
      tagClass: "bg-[#EAF3DE] text-[#27500A]",
    };
  }
  if (adv) {
    const tags = ["Adventure"];
    if (/\b(outdoor|outside|trek|trail)\b/.test(raw)) tags.push("Outdoor");
    return {
      emoji: "🚴",
      tags: tags.slice(0, 3),
      tileClass: "bg-[#E6F1FB] text-[#0C447C]",
      tagClass: "bg-[#E6F1FB] text-[#0C447C]",
    };
  }
  return {
    emoji: "📍",
    tags: ["Plan"],
    tileClass: "bg-slate-100 text-slate-700",
    tagClass: "bg-slate-200/80 text-slate-700",
  };
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

function IconPlusSmall({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
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
    <div className="relative shrink-0 self-start" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/35 bg-transparent px-3 py-2 text-sm font-medium text-white/95 transition hover:bg-white/10"
      >
        Manage trip
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-slate-800 py-1 shadow-lg sm:left-auto sm:right-0 sm:min-w-[12rem]"
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
  const { pending: deletePending, runAction: runDeleteActivity } = useFormActionFeedback();

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
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={deletePending}
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            onClick={() => {
              if (!window.confirm("Delete this activity? This cannot be undone.")) {
                return;
              }
              setOpen(false);
              runDeleteActivity(() =>
                deleteItineraryItemAction(tripId, item.id, new FormData()),
              );
            }}
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
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
  autoOpenAddActivity = false,
  itinerarySetupComplete = true,
}: TripItineraryShellProps) {
  const { runAction } = useFormActionFeedback();
  const activeTripTab = useTripActiveTab();
  const itineraryTabActive = activeTripTab === "itinerary";
  const { setOpenActivity } = useTripFabRegistry();

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

  useEffect(() => {
    if (!itineraryTabActive) {
      queueMicrotask(() => {
        setSheetOpen(false);
        setTripUpdateOpen(false);
      });
    }
  }, [itineraryTabActive]);

  const saveAction = useCallback(
    (fd: FormData) => saveItineraryActivityAction(tripId, fd),
    [tripId],
  );

  const openAdd = useCallback(() => {
    formKeySeq.current += 1;
    setSheetInitial({
      activityName: "",
      location: "",
      time: "",
      date: defaultDateForAdd,
    });
    setFormKey(`new-${formKeySeq.current}`);
    setSheetOpen(true);
  }, [defaultDateForAdd]);

  const generateAiAction = useCallback(
    (fd: FormData) => generateAiItineraryAction(tripId, fd),
    [tripId],
  );
  const importPdfAction = useCallback(
    (fd: FormData) => importPdfItineraryAction(tripId, fd),
    [tripId],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        `travel-os-itinerary-cache:${tripId}`,
        JSON.stringify({
          orderedDates,
          grouped,
          cachedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // ignore cache write failures
    }
  }, [grouped, orderedDates, tripId]);

  useEffect(() => {
    setOpenActivity(openAdd);
    return () => setOpenActivity(null);
  }, [setOpenActivity, openAdd]);

  useEffect(() => {
    if (!itineraryTabActive || !autoOpenAddActivity || !itinerarySetupComplete) return;
    queueMicrotask(() => openAdd());
  }, [autoOpenAddActivity, itinerarySetupComplete, itineraryTabActive, openAdd]);

  useEffect(() => {
    const onQuickAction = (event: Event) => {
      if (!itineraryTabActive || !itinerarySetupComplete) return;
      const detail = (event as CustomEvent<{ action?: string }>).detail;
      if (detail?.action === "activity") openAdd();
    };
    window.addEventListener(QUICK_ACTION_EVENT, onQuickAction as EventListener);
    return () => window.removeEventListener(QUICK_ACTION_EVENT, onQuickAction as EventListener);
  }, [itinerarySetupComplete, itineraryTabActive, openAdd]);

  const openAddForDate = (date: string) => {
    formKeySeq.current += 1;
    setSheetInitial({
      activityName: "",
      location: "",
      time: "",
      date,
    });
    setFormKey(`new-${date}-${formKeySeq.current}`);
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

  const totalActivities = orderedDates.reduce((n, d) => n + (grouped[d]?.length ?? 0), 0);
  const totalComments = Object.values(activityCommentsByItemId).reduce(
    (n, arr) => n + (arr?.length ?? 0),
    0,
  );
  const dayCount = orderedDates.length;
  const shouldShowItinerarySetupPrompt = !itinerarySetupComplete;
  const shouldShowDayWiseItinerary = itinerarySetupComplete;

  return (
    <>
      <section className="rounded-xl bg-[#1a2340] p-5 text-white shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight text-white">{tripTitle}</h1>
            <p className="mt-2 text-sm text-white/70">{dateRangeLabel}</p>
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

      {shouldShowDayWiseItinerary && orderedDates.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-black/[0.12] bg-white px-3 py-1 text-xs font-medium text-slate-700">
            {totalActivities} activit{totalActivities === 1 ? "y" : "ies"}
          </span>
          <span className="inline-flex items-center rounded-full border border-black/[0.12] bg-white px-3 py-1 text-xs font-medium text-slate-700">
            {dayCount} day{dayCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center rounded-full border border-black/[0.12] bg-white px-3 py-1 text-xs font-medium text-slate-700">
            {totalComments} comment{totalComments === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}

      <section className="mt-4 rounded-xl border border-black/[0.08] bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-[#1a2340]">Itinerary</h2>

        {shouldShowItinerarySetupPrompt ? (
          <div className="mt-3">
            <ItineraryCreationSetup
              tripId={tripId}
              onGenerateAi={generateAiAction}
              onImportPdf={importPdfAction}
              onChooseManual={() => {
                runAction(() => completeItinerarySetupManualAction(tripId), () => openAdd());
              }}
            />
          </div>
        ) : null}

        {initialError ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{initialError}</p>
        ) : null}

        {shouldShowDayWiseItinerary ? emptyState : null}

        {shouldShowDayWiseItinerary && orderedDates.length > 0 ? (
          <div className="mt-5 space-y-8">
            {orderedDates.map((date) => {
              const dateItems = grouped[date] ?? [];
              return (
                <div key={date}>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1a2340]" aria-hidden />
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {formatDateLabelUpper(date)}
                    </span>
                    <span className="h-px min-w-0 flex-1 bg-slate-200" aria-hidden />
                  </div>
                  <div className="mt-4 space-y-3">
                    {dateItems.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => openAddForDate(date)}
                        className="flex w-full min-h-12 touch-manipulation items-center justify-center gap-2 rounded-xl border border-dashed border-black/[0.15] bg-white py-3 text-sm text-slate-500 transition active:bg-slate-50"
                      >
                        <IconPlusSmall className="h-4 w-4" aria-hidden />
                        Add activity
                      </button>
                    ) : (
                      <>
                        {dateItems.map((item) => {
                          const vis = inferActivityVisual(
                            item.activity_name,
                            item.title,
                            item.location,
                          );
                          const fullTitleText = item.activity_name || item.title || "Activity";
                          const titleText = compactActivityTitle(item.activity_name, item.title);
                          return (
                            <article
                              key={item.id}
                              className="rounded-2xl border border-black/[0.08] bg-white p-3.5 shadow-sm"
                            >
                              <div className="flex items-start gap-3">
                                <ActivityDetailsNavLink
                                  href={`/app/trip/${encodeURIComponent(tripId)}/activity/${encodeURIComponent(item.id)}?from=itinerary`}
                                  className="flex min-w-0 flex-1 items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                >
                                  <div
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg leading-none ${vis.tileClass}`}
                                    aria-hidden
                                  >
                                    {vis.emoji}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className="line-clamp-2 text-[14px] font-semibold leading-5 text-slate-900"
                                      title={fullTitleText}
                                    >
                                      {titleText}
                                    </p>
                                    <p className="mt-1.5 flex items-start gap-1 text-xs text-slate-500">
                                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 opacity-70" aria-hidden />
                                      <span className="truncate">
                                        {item.location?.trim() ? item.location : "Location TBD"}
                                      </span>
                                    </p>
                                  </div>
                                </ActivityDetailsNavLink>
                                <div className="flex shrink-0 items-start gap-1">
                                  {item.time ? (
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                      {item.time}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                                      Time TBD
                                    </span>
                                  )}
                                  <ActivityRowMenu tripId={tripId} item={item} onEdit={() => openEdit(item)} />
                                </div>
                              </div>
                              {vis.tags.length > 0 ? (
                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                  {vis.tags.slice(0, 2).map((tag) => (
                                    <span
                                      key={tag}
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${vis.tagClass}`}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <EntityCommentsBlock
                                tripId={tripId}
                                entityType="activity"
                                entityId={item.id}
                                currentUserId={currentUserId}
                                initialComments={activityCommentsByItemId[item.id] ?? []}
                                memberLabelByUserId={memberLabelByUserId}
                                collapsible
                              />
                            </article>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => openAddForDate(date)}
                          className="flex w-full min-h-12 touch-manipulation items-center justify-center gap-2 rounded-xl border border-dashed border-black/[0.15] bg-white py-3 text-sm text-slate-500 transition active:bg-slate-50"
                        >
                          <IconPlusSmall className="h-4 w-4" aria-hidden />
                          Add activity
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {itineraryTabActive ? (
        <ActivityBottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          initial={sheetInitial}
          formKey={formKey}
          saveAction={saveAction}
        />
      ) : null}

      {itineraryTabActive ? (
        <TripUpdateBottomSheet
          open={tripUpdateOpen}
          onClose={() => setTripUpdateOpen(false)}
          tripId={tripId}
          defaults={tripEditDefaults}
          formKey={`${tripId}-${tripUpdateFormKey}`}
        />
      ) : null}
    </>
  );
}
