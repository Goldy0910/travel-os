"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

const LAST_TRIP_STORAGE_KEY = "travel-os-last-trip-id";

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

function DocsIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "text-slate-900" : "text-slate-400"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

function ExpensesIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "text-slate-900" : "text-slate-400"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 14h2" />
    </svg>
  );
}

function MembersIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "text-slate-900" : "text-slate-400"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="9" cy="7" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 19.5v-.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v.5M17 14h.5a2.5 2.5 0 0 1 2.5 2.5V19" />
    </svg>
  );
}

export default function MobileBottomNav() {
  const searchParams = useSearchParams();
  const pathname = usePathname() || "";

  const storedLastTripId = useMemo(() => {
    void pathname;
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(LAST_TRIP_STORAGE_KEY);
    } catch {
      return null;
    }
  }, [pathname]);

  useEffect(() => {
    const fromPath = extractTripIdFromPath(pathname);
    if (!fromPath) return;
    try {
      sessionStorage.setItem(LAST_TRIP_STORAGE_KEY, fromPath);
    } catch {
      /* ignore */
    }
  }, [pathname]);

  const pathForUi = pathname;
  const pathTripId = extractTripIdFromPath(pathForUi);

  const normalizedPath = pathForUi.startsWith("/app/")
    ? pathForUi.slice(4)
    : pathForUi;

  const tripFromHome =
    normalizedPath === "/home" ? (searchParams.get("trip")?.trim() || null) : null;

  const effectiveTripId =
    pathTripId ||
    (tripFromHome && tripFromHome.length > 0 ? tripFromHome : null) ||
    storedLastTripId;

  const onTripToolPage =
    !!extractTripIdFromPath(pathForUi) &&
    (normalizedPath.includes("/docs") ||
      normalizedPath.includes("/expenses") ||
      normalizedPath.includes("/members") ||
      normalizedPath.includes("/chat"));

  const tabs = [
    {
      label: "Home",
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
      label: "Docs",
      href: effectiveTripId
        ? `/app/trip/${encodeURIComponent(effectiveTripId)}/docs`
        : "/app/docs",
      active: normalizedPath.includes("/docs"),
      icon: DocsIcon,
    },
    {
      label: "Expenses",
      href: effectiveTripId
        ? `/app/trip/${encodeURIComponent(effectiveTripId)}/expenses`
        : "/app/expenses",
      active: normalizedPath.includes("/expenses"),
      icon: ExpensesIcon,
    },
    {
      label: "Members",
      href: effectiveTripId
        ? `/app/trip/${encodeURIComponent(effectiveTripId)}/members`
        : "/app/trips",
      active: normalizedPath.includes("/members"),
      icon: MembersIcon,
    },
  ];

  return (
    <nav
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
      aria-label="App"
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-5 px-0.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={`${tab.label}-${tab.href}`}
              href={tab.href}
              prefetch={false}
              className="relative z-[101] flex min-h-12 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 touch-manipulation"
            >
              <Icon active={tab.active} />
              <span
                className={`max-w-full truncate px-0.5 text-center text-[10px] font-medium sm:text-xs ${
                  tab.active ? "text-slate-900" : "text-slate-500"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
