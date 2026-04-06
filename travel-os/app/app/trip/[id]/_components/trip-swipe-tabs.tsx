"use client";

import { TripActiveTabProvider } from "@/app/app/trip/[id]/_lib/trip-active-tab-context";
import { TripFabRegistryProvider } from "@/app/app/trip/[id]/_lib/trip-tab-fab-registry";
import {
  parseTripTabParam,
  TRIP_TAB_KEYS,
  TRIP_TAB_LABELS,
  type TripTabKey,
} from "@/app/app/trip/[id]/_lib/trip-tab-keys";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState, useTransition } from "react";

const TAB_COUNT = TRIP_TAB_KEYS.length;

type Props = {
  itinerary: ReactNode;
  expenses: ReactNode;
  chat: ReactNode;
  docs: ReactNode;
  guides: ReactNode;
  members: ReactNode;
};

/**
 * Trip section tabs: one panel visible at a time (no horizontal swipe carousel).
 * Avoids mobile browsers treating vertical scroll as horizontal tab changes and
 * conflicts with nested horizontal strips (e.g. Guides categories).
 */
export default function TripSwipeTabs({
  itinerary,
  expenses,
  chat,
  docs,
  guides,
  members,
}: Props) {
  const panels: ReactNode[] = [itinerary, expenses, chat, docs, guides, members];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabKey = parseTripTabParam(searchParams.get("tab"));
  const urlIndex = TRIP_TAB_KEYS.indexOf(tabKey);

  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const previousUrlIndexRef = useRef(urlIndex);
  const [pendingTabKey, setPendingTabKey] = useState<TripTabKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const replaceTab = useCallback(
    (key: TripTabKey) => {
      const next = new URLSearchParams(searchParams.toString());
      if (key === "itinerary") {
        next.delete("tab");
      } else {
        next.set("tab", key);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /** Reset vertical scroll when the active tab changes (URL-driven). */
  useEffect(() => {
    const previous = previousUrlIndexRef.current;
    previousUrlIndexRef.current = urlIndex;
    if (previous === urlIndex) return;

    const appShellScrollRoot = document.getElementById("app-shell-scroll-root");
    if (appShellScrollRoot) {
      appShellScrollRoot.scrollTo({ top: 0, behavior: "auto" });
      appShellScrollRoot.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [urlIndex]);

  useEffect(() => {
    const btn = tabBtnRefs.current[urlIndex];
    const bar = tabBarRef.current;
    if (!btn || !bar) return;
    const gr = bar.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    if (br.left < gr.left + 8) {
      bar.scrollTo({ left: bar.scrollLeft + (br.left - gr.left) - 16, behavior: "smooth" });
    } else if (br.right > gr.right - 8) {
      bar.scrollTo({ left: bar.scrollLeft + (br.right - gr.right) + 16, behavior: "smooth" });
    }
  }, [urlIndex]);

  const goToIndex = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(TAB_COUNT - 1, i));
      const key = TRIP_TAB_KEYS[clamped]!;
      if (key === tabKey) return;
      setPendingTabKey(key);
      startTransition(() => {
        replaceTab(key);
      });
    },
    [replaceTab, tabKey],
  );

  const activeTabKey: TripTabKey = TRIP_TAB_KEYS[urlIndex] ?? "itinerary";

  return (
    <TripActiveTabProvider activeTab={activeTabKey}>
      <TripFabRegistryProvider activeTab={activeTabKey}>
        <div className="flex w-full max-w-md flex-col self-center">
          <nav
            ref={tabBarRef}
            className="scrollbar-hide sticky top-0 z-[115] -mx-4 flex gap-0.5 overflow-x-auto overscroll-x-contain border-b border-slate-200/90 bg-white/95 px-3 pb-0 pt-1 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 [touch-action:pan-x]"
            aria-label="Trip sections"
          >
            {TRIP_TAB_KEYS.map((key, i) => {
              const active = i === urlIndex;
              const showPending = !active && isPending && pendingTabKey === key;
              return (
                <button
                  key={key}
                  ref={(el) => {
                    tabBtnRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`trip-panel-${key}`}
                  id={`trip-tab-${key}`}
                  onClick={() => goToIndex(i)}
                  className={`relative min-h-11 shrink-0 touch-manipulation rounded-t-lg px-3.5 py-3 text-sm transition-colors sm:px-4 ${
                    active
                      ? "font-semibold text-slate-900"
                      : "font-medium text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {showPending ? (
                      <span
                        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
                        aria-hidden
                      />
                    ) : null}
                    {TRIP_TAB_LABELS[key]}
                  </span>
                  <span
                    className={`absolute inset-x-1.5 bottom-0 h-[3px] rounded-full bg-slate-900 transition-all duration-200 ease-out ${
                      active ? "opacity-100 scale-x-100" : "opacity-0 scale-x-50"
                    }`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </nav>

          <div className="w-full overflow-x-hidden">
            {isPending ? (
              <div className="px-4 pt-3" aria-live="polite">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-slate-500" />
                </div>
              </div>
            ) : null}
            {panels.map((panel, i) => {
              const key = TRIP_TAB_KEYS[i]!;
              const visible = i === urlIndex;
              return (
                <section
                  key={key}
                  id={`trip-panel-${key}`}
                  role="tabpanel"
                  aria-labelledby={`trip-tab-${key}`}
                  aria-hidden={!visible}
                  hidden={!visible}
                  className="box-border w-full px-4 py-4 pb-28"
                >
                  {panel}
                </section>
              );
            })}
          </div>
        </div>
      </TripFabRegistryProvider>
    </TripActiveTabProvider>
  );
}
