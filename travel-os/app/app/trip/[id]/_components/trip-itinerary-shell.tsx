"use client";

import { ChevronDown, Clock3, MapPin, MessageCircle, Sparkles } from "lucide-react";
import type { RefObject } from "react";
import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
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
import ItineraryAiAssistant, {
  type AiSuggestionCard,
  type AssistantDayActivity,
} from "./itinerary-ai-assistant";

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
  priority_score?: number | null;
  sunset_sensitive?: boolean;
  booking_required?: boolean;
  ai_generated?: boolean;
  user_modified?: boolean;
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
  activityStateByItemId: Record<string, { status: string; delayMinutes: number | null }>;
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

function compactActivityTitle(activityName: string | null, title: string | null): string {
  const raw = (activityName || title || "Activity").trim();
  if (raw.length <= 60) return raw;
  return `${raw.slice(0, 57).trimEnd()}...`;
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

function IconDotsVerticalSmall({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="12" cy="6" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="18" r="1.8" />
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

function statusBadge(status: string | undefined, delayMinutes: number | null) {
  if (status === "completed") {
    return {
      label: "Completed",
      className: "bg-[#E8F5E9] text-[#2E7D32]",
      isDelayed: false,
    };
  }
  if (status === "skipped") {
    return {
      label: "Skipped",
      className: "bg-rose-50 text-rose-700",
      isDelayed: false,
    };
  }
  if (status === "delayed") {
    return {
      label: `Delayed${delayMinutes != null ? ` ${delayMinutes}m` : ""}`,
      className: "bg-[#FFF3E0] text-[#E65100]",
      isDelayed: true,
    };
  }
  if (status === "replaced") {
    return {
      label: "Replaced",
      className: "bg-violet-50 text-violet-700",
      isDelayed: false,
    };
  }
  return {
    label: "Planned",
    className: "bg-[#E8F5E9] text-[#2E7D32]",
    isDelayed: false,
  };
}

function estimateTravelMinutes(current: ItineraryItemDTO, next: ItineraryItemDTO | undefined): number | null {
  if (!next) return null;
  if (!current.location || !next.location) return 20;
  if (current.location.trim().toLowerCase() === next.location.trim().toLowerCase()) return 8;
  return 20;
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

type ItineraryActivityCardProps = {
  tripId: string;
  item: ItineraryItemDTO;
  status: ReturnType<typeof statusBadge>;
  commentCount: number;
  currentUserId: string;
  initialComments: EntityCommentDTO[];
  memberLabelByUserId: Record<string, string>;
  onEdit: () => void;
};

function ItineraryActivityCard({
  tripId,
  item,
  status,
  commentCount,
  currentUserId,
  initialComments,
  memberLabelByUserId,
  onEdit,
}: ItineraryActivityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const fullTitleText = item.activity_name || item.title || "Activity";
  const titleText = compactActivityTitle(item.activity_name, item.title);
  const locationText = item.location?.trim() ? item.location : "Location TBD";
  const pinTileClass = status.isDelayed
    ? "bg-[#FFF7ED] text-[#d97706]"
    : "bg-[#EEF2FF] text-indigo-600";
  const panelId = `activity-panel-${item.id}`;

  return (
    <article className="rounded-xl border border-black/[0.08] bg-white shadow-sm transition-colors hover:border-black/[0.16]">
      <div className="flex items-center gap-2 px-3 py-2">
        <ActivityDetailsNavLink
          href={`/app/trip/${encodeURIComponent(tripId)}/activity/${encodeURIComponent(item.id)}?from=itinerary`}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${pinTileClass}`}
            aria-hidden
          >
            <MapPin className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[13px] font-medium leading-tight text-slate-900"
              title={fullTitleText}
            >
              {titleText}
            </p>
            <p className="truncate text-[11px] leading-tight text-slate-500" title={locationText}>
              {locationText}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className={`rounded-full px-1.5 py-px text-[10px] font-medium ${status.className}`}>
                {status.label}
              </span>
              {item.ai_generated ? (
                <span className="rounded-full bg-[#EDE9FE] px-1.5 py-px text-[10px] font-medium text-[#6D28D9]">
                  AI
                </span>
              ) : null}
              {item.booking_required ? (
                <span className="rounded-full bg-violet-50 px-1.5 py-px text-[10px] font-medium text-violet-700">
                  Reservation
                </span>
              ) : null}
              {item.sunset_sensitive ? (
                <span className="rounded-full bg-orange-50 px-1.5 py-px text-[10px] font-medium text-orange-700">
                  Sunset
                </span>
              ) : null}
            </div>
          </div>
        </ActivityDetailsNavLink>

        <div className="flex shrink-0 items-center gap-1.5">
          {commentCount > 0 ? (
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              aria-expanded={isExpanded}
              aria-controls={panelId}
              className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 transition hover:bg-slate-200"
              title={`${commentCount} comment${commentCount === 1 ? "" : "s"}`}
            >
              <MessageCircle className="h-3 w-3" aria-hidden />
              <span className="tabular-nums">{commentCount}</span>
            </button>
          ) : null}
          {item.time ? (
            <span className="text-[12px] font-medium tabular-nums text-slate-700">
              {item.time}
            </span>
          ) : (
            <span className="text-[11px] font-medium tabular-nums text-slate-400">
              —
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-expanded={isExpanded}
            aria-controls={panelId}
            aria-label={isExpanded ? "Collapse comments" : "Expand comments"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          <ActivityRowMenu tripId={tripId} item={item} onEdit={onEdit} />
        </div>
      </div>

      <div
        id={panelId}
        hidden={!isExpanded}
        className="overflow-hidden rounded-b-xl"
      >
        <EntityCommentsBlock
          tripId={tripId}
          entityType="activity"
          entityId={item.id}
          currentUserId={currentUserId}
          initialComments={initialComments}
          memberLabelByUserId={memberLabelByUserId}
          collapsible
          externalOpen={isExpanded}
        />
      </div>
    </article>
  );
}

function TravelConnector({ minutes }: { minutes: number }) {
  return (
    <div
      className="flex items-center gap-1.5 pl-3.5 text-[10px] text-slate-500"
      aria-label={`${minutes} minute travel to next stop`}
    >
      <span className="block h-3 w-px bg-slate-300" aria-hidden />
      <Clock3 className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      <span>{minutes} min travel to next stop</span>
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
  activityStateByItemId,
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
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestionCard[]>([]);
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
  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  const assistantDate =
    (grouped[todayYmd]?.length ?? 0) > 0
      ? todayYmd
      : orderedDates.find((d) => (grouped[d]?.length ?? 0) > 0) ?? defaultDateForAdd;
  const assistantItems = grouped[assistantDate] ?? [];
  const assistantDayActivities: AssistantDayActivity[] = assistantItems.map((item) => ({
    id: item.id,
    title: item.activity_name || item.title || "Activity",
    time: item.time,
    sunsetSensitive: item.sunset_sensitive === true,
    status: activityStateByItemId[item.id]?.status ?? "pending",
  }));
  const skippedActivities = assistantDayActivities.filter((activity) => activity.status === "skipped").length;
  const completedActivities = assistantDayActivities.filter((activity) => activity.status === "completed").length;
  const remainingActivities = assistantDayActivities.length - completedActivities - skippedActivities;
  const averagePerDay = dayCount > 0 ? totalActivities / dayCount : totalActivities;
  const tripPace: "relaxed" | "balanced" | "packed" =
    averagePerDay >= 5 ? "packed" : averagePerDay >= 3 ? "balanced" : "relaxed";
  const delayedCount = assistantDayActivities.filter((activity) => activity.status === "delayed").length;
  const energyLevel: "low" | "medium" | "high" =
    delayedCount >= 2 || skippedActivities >= 2 ? "low" : delayedCount >= 1 ? "medium" : "high";
  const travelerPreferences = Array.from(
    new Set(
      assistantDayActivities.flatMap((activity) => {
        const text = activity.title.toLowerCase();
        const prefs: string[] = [];
        if (/food|restaurant|cafe|dining/.test(text)) prefs.push("foodie");
        if (/museum|culture|temple|heritage/.test(text)) prefs.push("culture");
        if (/night|bar|club/.test(text)) prefs.push("nightlife");
        if (/park|walk|trail|hike|view/.test(text)) prefs.push("explore");
        return prefs;
      }),
    ),
  );

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

      <section className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
        <p className="text-sm font-semibold text-indigo-900">Plan day by day with your group</p>
        <p className="mt-1 text-xs leading-relaxed text-indigo-800">
          Use Itinerary to map each day, add activities with time and location, and keep everyone aligned on the plan.
        </p>
      </section>

      {aiSuggestions.length > 0 ? (
        <section className="space-y-2">
          {aiSuggestions.slice(0, 3).map((suggestion) => (
            <article
              key={suggestion.id}
              className="rounded-2xl border border-indigo-100 bg-white px-3 py-2.5 shadow-sm transition-all duration-300"
            >
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                <span>{suggestion.text}</span>
              </p>
            </article>
          ))}
        </section>
      ) : null}

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
                  <div className="mt-3 space-y-1.5">
                    {dateItems.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => openAddForDate(date)}
                        className="flex w-full min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-black/[0.18] bg-white py-2.5 text-[11px] font-medium text-slate-500 transition active:bg-slate-50"
                        style={{ borderRadius: "10px" }}
                      >
                        <IconPlusSmall className="h-3.5 w-3.5" aria-hidden />
                        Add stop
                      </button>
                    ) : (
                      <>
                        {dateItems.map((item, idx) => {
                          const state = activityStateByItemId[item.id];
                          const status = statusBadge(state?.status, state?.delayMinutes ?? null);
                          const itemComments = activityCommentsByItemId[item.id] ?? [];
                          const travelMinutes = estimateTravelMinutes(item, dateItems[idx + 1]);
                          return (
                            <Fragment key={item.id}>
                              <ItineraryActivityCard
                                tripId={tripId}
                                item={item}
                                status={status}
                                commentCount={itemComments.length}
                                currentUserId={currentUserId}
                                initialComments={itemComments}
                                memberLabelByUserId={memberLabelByUserId}
                                onEdit={() => openEdit(item)}
                              />
                              {idx < dateItems.length - 1 && travelMinutes != null ? (
                                <TravelConnector minutes={travelMinutes} />
                              ) : null}
                            </Fragment>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => openAddForDate(date)}
                          className="mt-1.5 flex w-full min-h-11 touch-manipulation items-center justify-center gap-1.5 border border-dashed border-black/[0.18] bg-white py-2.5 text-[11px] font-medium text-slate-500 transition active:bg-slate-50"
                          style={{ borderRadius: "10px" }}
                        >
                          <IconPlusSmall className="h-3.5 w-3.5" aria-hidden />
                          Add stop
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

      {itineraryTabActive && itinerarySetupComplete ? (
        <ItineraryAiAssistant
          tripId={tripId}
          date={assistantDate}
          dayActivities={assistantDayActivities}
          skippedActivities={skippedActivities}
          completedActivities={completedActivities}
          remainingActivities={remainingActivities}
          tripPace={tripPace}
          energyLevel={energyLevel}
          travelerPreferences={travelerPreferences}
          onSuggestion={(card) => setAiSuggestions((prev) => [card, ...prev].slice(0, 6))}
        />
      ) : null}

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
