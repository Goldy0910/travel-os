"use client";

import PageLoader from "@/components/ui/page-loader";
import { TripActiveTabProvider } from "@/app/app/trip/[id]/_lib/trip-active-tab-context";
import { TripFabRegistryProvider } from "@/app/app/trip/[id]/_lib/trip-tab-fab-registry";
import {
  isDefaultTripTab,
  parseTripTabParam,
  TRIP_TAB_BAR_KEYS,
  TRIP_TAB_KEYS,
  TRIP_TAB_LABELS,
  type TripTabKey,
} from "@/app/app/trip/[id]/_lib/trip-tab-keys";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { TripDocsClientInputProps } from "@/app/app/trip/[id]/docs/_components/trip-docs-client";
import TripDocsClient from "@/app/app/trip/[id]/docs/_components/trip-docs-client";

const TAB_COUNT = TRIP_TAB_KEYS.length;

type Props = {
  chat: ReactNode;
  itinerary: ReactNode;
  expenses: ReactNode;
  members: ReactNode;
  docsProps: TripDocsClientInputProps | null;
  guides: ReactNode;
  language: ReactNode;
  checklist: ReactNode;
  food: ReactNode;
  tools: ReactNode;
};

/**
 * Trip section tabs: one panel visible at a time (no horizontal swipe carousel).
 * Avoids mobile browsers treating vertical scroll as horizontal tab changes and
 * conflicts with nested horizontal strips (e.g. Guide categories).
 */
export default function TripSwipeTabs({
  chat,
  itinerary,
  expenses,
  members,
  docsProps,
  guides,
  language,
  checklist,
  food,
  tools,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabKey = parseTripTabParam(searchParams.get("tab"), searchParams.get("section"));
  const urlIndex = TRIP_TAB_KEYS.indexOf(tabKey);
  const [uiTabKey, setUiTabKey] = useState<TripTabKey>(tabKey);

  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const previousUrlIndexRef = useRef(urlIndex);
  const prefetchedRef = useRef<Set<string>>(new Set());
  const panelCacheRef = useRef<Partial<Record<TripTabKey, ReactNode>>>({});
  const [isTabPending, startTabTransition] = useTransition();
  const uiIndex = Math.max(0, TRIP_TAB_KEYS.indexOf(uiTabKey));

  const docsPanel = useMemo(() => {
    if (docsProps == null) return null;
    return <TripDocsClient {...docsProps} connectDocsActive />;
  }, [docsProps]);

  const panels: ReactNode[] = useMemo(
    () => [
      chat,
      itinerary,
      expenses,
      members,
      docsPanel,
      guides,
      language,
      tools,
      checklist,
      food,
    ],
    [chat, itinerary, expenses, members, docsPanel, guides, language, tools, checklist, food],
  );

  const tabHrefByKey = useMemo(() => {
    const base = new URLSearchParams(searchParams.toString());
    const out = {} as Record<TripTabKey, string>;
    for (const key of TRIP_TAB_KEYS) {
      const sp = new URLSearchParams(base.toString());
      if (isDefaultTripTab(key)) sp.delete("tab");
      else sp.set("tab", key);
      sp.delete("section");
      const qs = sp.toString();
      out[key] = qs ? `${pathname}?${qs}` : pathname;
    }
    return out;
  }, [pathname, searchParams]);

  const replaceTab = useCallback(
    (key: TripTabKey) => {
      const next = new URLSearchParams(searchParams.toString());
      if (isDefaultTripTab(key)) {
        next.delete("tab");
      } else {
        next.set("tab", key);
      }
      next.delete("section");
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

  useLayoutEffect(() => {
    const barKeyIndex = TRIP_TAB_BAR_KEYS.indexOf(
      uiTabKey as (typeof TRIP_TAB_BAR_KEYS)[number],
    );
    if (barKeyIndex < 0) return;
    const btn = tabBtnRefs.current[barKeyIndex];
    const bar = tabBarRef.current;
    if (!btn || !bar) return;
    const gr = bar.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    if (br.left < gr.left + 8) {
      bar.scrollTo({ left: bar.scrollLeft + (br.left - gr.left) - 16, behavior: "smooth" });
    } else if (br.right > gr.right - 8) {
      bar.scrollTo({ left: bar.scrollLeft + (br.right - gr.right) + 16, behavior: "smooth" });
    }
  }, [uiTabKey]);

  useEffect(() => {
    const active = uiIndex;
    const likely = [active - 1, active + 1]
      .filter((i) => i >= 0 && i < TAB_COUNT)
      .map((i) => TRIP_TAB_KEYS[i]!);
    likely.forEach(prefetchTab);

    const rest = TRIP_TAB_KEYS.filter((k) => k !== tabKey && !likely.includes(k));
    let cancelled = false;
    const schedule =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (cb: () => void) =>
            (window as Window & { requestIdleCallback: (fn: () => void) => number }).requestIdleCallback(
              cb,
            )
        : (cb: () => void) => window.setTimeout(cb, 250);
    schedule(() => {
      if (cancelled) return;
      rest.forEach(prefetchTab);
    });
    return () => {
      cancelled = true;
    };
  }, [prefetchTab, tabKey, uiIndex]);

  const goToBarIndex = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(TRIP_TAB_BAR_KEYS.length - 1, i));
      const key = TRIP_TAB_BAR_KEYS[clamped]!;
      if (key === uiTabKey) return;

      const cachedPanel = panelCacheRef.current[key];
      if (cachedPanel != null) {
        setUiTabKey(key);
        const next = new URLSearchParams(searchParams.toString());
        if (isDefaultTripTab(key)) next.delete("tab");
        else next.set("tab", key);
        next.delete("section");
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        return;
      }
      startTabTransition(() => {
        replaceTab(key);
      });
    },
    [pathname, replaceTab, router, searchParams, uiTabKey],
  );

  const activeTabKey: TripTabKey = TRIP_TAB_KEYS[uiIndex] ?? "chat";

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
        <div className="flex w-full flex-col">
          <nav
            ref={tabBarRef}
            className="scrollbar-hide sticky top-0 z-[115] -mx-4 flex gap-0.5 overflow-x-auto overscroll-x-contain border-b border-slate-200/90 bg-white/95 px-3 pb-0 pt-1 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 [touch-action:pan-x]"
            aria-label="Trip sections"
          >
            {TRIP_TAB_BAR_KEYS.map((key, i) => {
              const active = key === uiTabKey;
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
                  onClick={() => goToBarIndex(i)}
                  className={`relative min-h-11 shrink-0 touch-manipulation rounded-t-lg px-3 py-3 text-[13px] transition-colors sm:px-3.5 sm:text-sm ${
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
              // Chat fills the tab edge-to-edge (like the standalone chat page) instead of
              // sitting in the padded content column other tabs use.
              const isChat = key === "chat";
              // On large screens the itinerary tab boxes itself to the viewport so its
              // internal two-pane layout (scrollable list + static map) can size correctly.
              const isItinerary = key === "itinerary";
              return (
                <section
                  key={key}
                  id={`trip-panel-${key}`}
                  role="tabpanel"
                  aria-labelledby={`trip-tab-${key}`}
                  aria-hidden={!visible}
                  hidden={!visible}
                  className={
                    isChat
                      ? "box-border h-[calc(100dvh-3.5rem-3.25rem-var(--travel-os-bottom-nav-h))] w-full overflow-hidden"
                      : isItinerary
                        ? "box-border w-full px-4 py-4 pb-[calc(var(--travel-os-bottom-nav-h)+3rem)] lg:h-[calc(100dvh-3.5rem-3.25rem-var(--travel-os-bottom-nav-h))] lg:overflow-hidden lg:pb-4"
                        : "box-border w-full px-4 py-4 pb-[calc(var(--travel-os-bottom-nav-h)+3rem)]"
                  }
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
