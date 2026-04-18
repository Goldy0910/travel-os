"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import MobileNavTabInner from "./mobile-nav-tab-inner";
import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import { Plus, UserRound } from "lucide-react";

const LAST_TRIP_STORAGE_KEY = "travel-os-last-trip-id";
const QUICK_ACTION_EVENT = "travel-os-open-quick-action";

function extractTripIdFromPath(path: string): string | null {
  const m = path.match(/\/trip\/([^/?#]+)/i);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "text-slate-900" : "text-slate-400"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

function TripsIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "text-slate-900" : "text-slate-400"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <UserRound
      className={`h-5 w-5 ${active ? "text-slate-900" : "text-slate-400"}`}
      strokeWidth={2}
      aria-hidden
    />
  );
}

export default function MobileBottomNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || "";

  /** Only set after mount so first client render matches SSR (avoids hydration mismatch). */
  const [storedLastTripId, setStoredLastTripId] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [fabLoading, setFabLoading] = useState(false);

  useEffect(() => {
    const fromPath = extractTripIdFromPath(pathname);
    if (fromPath) {
      try {
        sessionStorage.setItem(LAST_TRIP_STORAGE_KEY, fromPath);
      } catch {
        /* ignore */
      }
    }
    queueMicrotask(() => {
      try {
        const v = sessionStorage.getItem(LAST_TRIP_STORAGE_KEY);
        const trimmed = v?.trim() ?? "";
        setStoredLastTripId(trimmed.length > 0 ? trimmed : null);
      } catch {
        setStoredLastTripId(null);
      }
    });
  }, [pathname]);

  useEffect(() => {
    // Route/search change means navigation finished; stop FAB loader.
    queueMicrotask(() => setFabLoading(false));
  }, [pathname, searchParams]);

  const pathForUi = pathname;
  const pathTripId = extractTripIdFromPath(pathForUi);

  const normalizedPath = pathForUi.startsWith("/app/")
    ? pathForUi.slice(4)
    : pathForUi;

  if (normalizedPath === "/login") {
    return null;
  }

  const tripFromHome =
    normalizedPath === "/home" ? (searchParams.get("trip")?.trim() || null) : null;

  const effectiveTripId =
    pathTripId ||
    (tripFromHome && tripFromHome.length > 0 ? tripFromHome : null) ||
    storedLastTripId;

  const tripTabParam = searchParams.get("tab");
  const isTripTabTool =
    !!pathTripId &&
    (tripTabParam === "docs" ||
      tripTabParam === "expenses" ||
      tripTabParam === "members" ||
      tripTabParam === "chat" ||
      tripTabParam === "connect" ||
      tripTabParam === "guides" ||
      tripTabParam === "checklist" ||
      tripTabParam === "food" ||
      tripTabParam === "language");

  const onTripToolPage =
    !!extractTripIdFromPath(pathForUi) &&
    (normalizedPath.includes("/docs") ||
      normalizedPath.includes("/expenses") ||
      normalizedPath.includes("/members") ||
      normalizedPath.includes("/chat") ||
      isTripTabTool);

  const tripTabLower = (tripTabParam ?? "").toLowerCase();
  const sectionLower = (searchParams.get("section") ?? "").toLowerCase();
  const connectShowsDocsFab =
    tripTabLower === "docs" ||
    (tripTabLower === "connect" && sectionLower === "docs");
  // On trip Connect (any segment) or legacy `?tab=docs`, hide this FAB so it does not stack above the trip upload button (z-122 vs z-110).
  const hideFabOnTripTab =
    !!pathTripId &&
    (tripTabLower === "guides" ||
      tripTabLower === "checklist" ||
      tripTabLower === "food" ||
      tripTabLower === "language" ||
      tripTabLower === "members" ||
      tripTabLower === "chat" ||
      tripTabLower === "connect" ||
      connectShowsDocsFab);
  const hideFabOnGlobalMembers = normalizedPath === "/members";
  const hideFabOnLocalApps =
    normalizedPath === "/local-apps" || normalizedPath.startsWith("/local-apps/");
  const hideFabOnForex =
    normalizedPath === "/forex" || normalizedPath.startsWith("/forex/");
  /** FAB navigates here; fixed primary CTA already fills the thumb zone — overlap breaks mobile layout. */
  const hideFabOnCreateTrip =
    normalizedPath === "/create-trip" || normalizedPath.startsWith("/create-trip/");
  const showFab =
    !hideFabOnTripTab &&
    !hideFabOnGlobalMembers &&
    !hideFabOnLocalApps &&
    !hideFabOnForex &&
    !hideFabOnCreateTrip;

  const fabAriaLabel =
    normalizedPath === "/home" || normalizedPath === "/trips"
      ? "Create new trip"
      : pathTripId
        ? "Quick add for this trip"
        : "Open quick actions";

  const tabs = [
    {
      label: "Homepage",
      href: "/app/home",
      active: normalizedPath === "/home",
      icon: HomeIcon,
    },
    {
      label: "Trips",
      href: "/app/trips",
      active:
        normalizedPath === "/trips" ||
        normalizedPath.startsWith("/create-trip") ||
        (normalizedPath.startsWith("/trip/") && !onTripToolPage),
      icon: TripsIcon,
    },
    {
      label: "Profile",
      href: "/app/settings",
      active: normalizedPath === "/settings",
      icon: ProfileIcon,
    },
  ];

  const actionHref = (tab: "expenses" | "docs" | "itinerary") => {
    if (effectiveTripId) {
      const sp = new URLSearchParams();
      if (tab !== "itinerary") sp.set("tab", tab);
      sp.set("quickAction", tab === "itinerary" ? "activity" : tab === "docs" ? "doc" : "expense");
      const qs = sp.toString();
      return `/app/trip/${encodeURIComponent(effectiveTripId)}${qs ? `?${qs}` : ""}`;
    }
    if (tab === "docs") return "/app/docs";
    if (tab === "expenses") return "/app/expenses";
    return "/app/trips";
  };

  const onFabClick = () => {
    // Home and trips list are itinerary-style hubs; + starts a new trip (not expense/doc/activity shortcuts).
    if (normalizedPath === "/home" || normalizedPath === "/trips") {
      setFabLoading(true);
      router.push("/app/create-trip");
      return;
    }

    // Trip details page: open tab-specific modal directly.
    if (pathTripId) {
      const sp = new URLSearchParams(searchParams.toString());
      const tab = (sp.get("tab") ?? "itinerary").toLowerCase();
      const section = (sp.get("section") ?? "").toLowerCase();
      const action =
        tab === "docs" || (tab === "connect" && section === "docs")
          ? "doc"
          : tab === "expenses"
            ? "expense"
            : "activity";
      window.dispatchEvent(new CustomEvent(QUICK_ACTION_EVENT, { detail: { action } }));
      return;
    }

    // Global docs/expenses pages: jump to active trip tab and auto-open modal.
    if (normalizedPath === "/docs" && effectiveTripId) {
      setFabLoading(true);
      router.push(
        `/app/trip/${encodeURIComponent(effectiveTripId)}?tab=connect&section=docs&quickAction=doc`,
      );
      return;
    }
    if (normalizedPath === "/expenses" && effectiveTripId) {
      setFabLoading(true);
      router.push(
        `/app/trip/${encodeURIComponent(effectiveTripId)}?tab=expenses&quickAction=expense`,
      );
      return;
    }

    setActionsOpen((v) => !v);
  };

  return (
    <>
      {actionsOpen ? (
        <div
          className="fixed inset-0 z-[120] bg-slate-900/35 backdrop-blur-[1px]"
          onClick={() => setActionsOpen(false)}
          aria-hidden
        />
      ) : null}
      {actionsOpen ? (
        <div className="fixed inset-x-0 bottom-[calc(var(--travel-os-bottom-nav-h)+0.75rem)] z-[121] px-4">
          <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              QUICK ACTIONS
            </p>
            <div className="space-y-1">
              <Link
                href={actionHref("expenses")}
                onClick={() => setActionsOpen(false)}
                className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                <span>Add Expense</span>
                <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-600" />
              </Link>
              <Link
                href={actionHref("docs")}
                onClick={() => setActionsOpen(false)}
                className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                <span>Upload Doc</span>
                <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-600" />
              </Link>
              <Link
                href={actionHref("itinerary")}
                onClick={() => setActionsOpen(false)}
                className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                <span>Add Activity</span>
                <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-600" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {showFab ? (
        <button
          type="button"
          onClick={onFabClick}
          disabled={fabLoading}
          className="fixed bottom-[var(--travel-os-fab-bottom)] right-[max(1rem,env(safe-area-inset-right,0px))] z-[122] flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 p-0 text-white shadow-lg shadow-slate-900/25 ring-0 outline-none [appearance:none] [backface-visibility:hidden] [box-sizing:border-box] [transform:translateZ(0)] [webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none focus-visible:ring-0 disabled:opacity-85"
          aria-label={fabAriaLabel}
          aria-expanded={actionsOpen}
        >
          <span className="pointer-events-none flex h-5 w-5 items-center justify-center">
            {fabLoading ? (
              <span className="grid h-5 w-5 grid-cols-3 place-items-center gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white [animation-delay:140ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white [animation-delay:280ms]" />
              </span>
            ) : (
              <Plus className="h-[18px] w-[18px] shrink-0" strokeWidth={2.75} aria-hidden />
            )}
          </span>
        </button>
      ) : null}

      <nav
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
        aria-label="App"
      >
        <div className="mx-auto grid w-full max-w-md grid-cols-3 px-0.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className="relative z-[101] flex min-h-12 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 touch-manipulation"
              >
                <MobileNavTabInner Icon={Icon} active={tab.active} label={tab.label} />
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
