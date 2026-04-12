"use client";

import PageLoader from "@/components/ui/page-loader";
import { TripActiveTabProvider } from "@/app/app/trip/[id]/_lib/trip-active-tab-context";
import { TripFabRegistryProvider } from "@/app/app/trip/[id]/_lib/trip-tab-fab-registry";
import {
  parseTripTabParam,
  TRIP_TAB_KEYS,
  TRIP_TAB_LABELS,
  type TripTabKey,
} from "@/app/app/trip/[id]/_lib/trip-tab-keys";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

const TAB_COUNT = TRIP_TAB_KEYS.length;

type Props = {
  itinerary: ReactNode;
  expenses: ReactNode;
  chat: ReactNode;
  docs: ReactNode;
  guides: ReactNode;
  members: ReactNode;
  checklist: ReactNode;
  food: ReactNode;
  language: ReactNode;
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
  checklist,
  food,
  language,
}: Props) {
  const panels: ReactNode[] = [itinerary, expenses, chat, docs, guides, members, checklist, food, language];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabKey = parseTripTabParam(searchParams.get("tab"));
  const urlIndex = TRIP_TAB_KEYS.indexOf(tabKey);
  const [uiTabKey, setUiTabKey] = useState<TripTabKey>(tabKey);

  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const previousUrlIndexRef = useRef(urlIndex);
  const prefetchedRef = useRef<Set<string>>(new Set());
  const panelCacheRef = useRef<Partial<Record<TripTabKey, ReactNode>>>({});
  const [isTabPending, startTabTransition] = useTransition();
  const uiIndex = Math.max(0, TRIP_TAB_KEYS.indexOf(uiTabKey));

  const tabHrefByKey = useMemo(() => {
    const base = new URLSearchParams(searchParams.toString());
    const out: Record<TripTabKey, string> = {
      itinerary: pathname,
      expenses: pathname,
      chat: pathname,
      docs: pathname,
      guides: pathname,
      members: pathname,
      checklist: pathname,
      food: pathname,
      language: pathname,
    };
    for (const key of TRIP_TAB_KEYS) {
      const sp = new URLSearchParams(base.toString());
      if (key === "itinerary") sp.delete("tab");
      else sp.set("tab", key);
      const qs = sp.toString();
      out[key] = qs ? `${pathname}?${qs}` : pathname;
    }
    return out;
  }, [pathname, searchParams]);

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

  const prefetchTab = useCallback(
    (key: TripTabKey) => {
      const href = tabHrefByKey[key];
      if (!href || prefetchedRef.current.has(href)) return;
      prefetchedRef.current.add(href);
      router.prefetch(href);
    },
    [router, tabHrefByKey],
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
    setUiTabKey(tabKey);
  }, [tabKey]);

  useEffect(() => {
    const btn = tabBtnRefs.current[uiIndex];
    const bar = tabBarRef.current;
    if (!btn || !bar) return;
    const gr = bar.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    if (br.left < gr.left + 8) {
      bar.scrollTo({ left: bar.scrollLeft + (br.left - gr.left) - 16, behavior: "smooth" });
    } else if (br.right > gr.right - 8) {
      bar.scrollTo({ left: bar.scrollLeft + (br.right - gr.right) + 16, behavior: "smooth" });
    }
  }, [uiIndex]);

  useEffect(() => {
    // Warm likely next taps first.
    const active = uiIndex;
    const likely = [active - 1, active + 1]
      .filter((i) => i >= 0 && i < TAB_COUNT)
      .map((i) => TRIP_TAB_KEYS[i]!);
    likely.forEach(prefetchTab);

    // Then prefetch remaining tabs in the background.
    const rest = TRIP_TAB_KEYS.filter((k) => k !== tabKey && !likely.includes(k));
    let cancelled = false;
    const schedule =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (cb: () => void) => (window as Window & { requestIdleCallback: (fn: () => void) => number }).requestIdleCallback(cb)
        : (cb: () => void) => window.setTimeout(cb, 250);
    schedule(() => {
      if (cancelled) return;
      rest.forEach(prefetchTab);
    });
    return () => {
      cancelled = true;
    };
  }, [prefetchTab, tabKey, uiIndex]);

  const goToIndex = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(TAB_COUNT - 1, i));
      const key = TRIP_TAB_KEYS[clamped]!;
      if (key === uiTabKey) return;

      const cachedPanel = panelCacheRef.current[key];
      if (cachedPanel != null) {
        setUiTabKey(key);
        const next = new URLSearchParams(searchParams.toString());
        if (key === "itinerary") next.delete("tab");
        else next.set("tab", key);
        const qs = next.toString();
        window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
        return;
      }
      startTabTransition(() => {
        replaceTab(key);
      });
    },
    [pathname, replaceTab, searchParams, uiTabKey],
  );

  const activeTabKey: TripTabKey = TRIP_TAB_KEYS[uiIndex] ?? "itinerary";

  /* Tab panels: parent passes null for inactive tabs; cache last non-null tree per key for instant restore. */
  /* eslint-disable react-hooks/refs -- ref holds memoized panel trees; read/write during render keeps cache in sync with props */
  for (let i = 0; i < panels.length; i += 1) {
    const key = TRIP_TAB_KEYS[i]!;
    const panel = panels[i];
    if (panel != null) {
      panelCacheRef.current[key] = panel;
    }
  }

  return (
    <TripActiveTabProvider activeTab={activeTabKey}>
      <TripFabRegistryProvider activeTab={activeTabKey}>
        <div className="flex w-full max-w-[390px] flex-col self-center">
          <nav
            ref={tabBarRef}
            className="scrollbar-hide sticky top-0 z-[115] -mx-4 flex gap-0.5 overflow-x-auto overscroll-x-contain border-b border-slate-200/90 bg-white/95 px-3 pb-0 pt-1 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 [touch-action:pan-x]"
            aria-label="Trip sections"
          >
            {TRIP_TAB_KEYS.map((key, i) => {
              const active = i === uiIndex;
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
                  onPointerEnter={() => prefetchTab(key)}
                  onTouchStart={() => prefetchTab(key)}
                  onClick={() => goToIndex(i)}
                  className={`relative min-h-11 shrink-0 touch-manipulation rounded-t-lg px-3.5 py-3 text-sm transition-colors sm:px-4 ${
                    active
                      ? "font-semibold text-slate-900"
                      : "font-medium text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {TRIP_TAB_LABELS[key]}
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

          <div className="relative w-full overflow-x-hidden">
            {isTabPending ? (
              <div
                className="absolute inset-0 z-20 flex min-h-[min(28rem,72dvh)] flex-col items-stretch justify-center bg-slate-50/90 backdrop-blur-[2px]"
                aria-live="polite"
                aria-busy="true"
              >
                <PageLoader message="Loading…" className="flex-1 py-16" />
              </div>
            ) : null}
            {panels.map((panel, i) => {
              const key = TRIP_TAB_KEYS[i]!;
              const visible = i === uiIndex;
              const content = panel ?? panelCacheRef.current[key] ?? null;
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
                  {content}
                </section>
              );
            })}
            {/* eslint-enable react-hooks/refs */}
          </div>
        </div>
      </TripFabRegistryProvider>
    </TripActiveTabProvider>
  );
}
