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
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const TAB_COUNT = TRIP_TAB_KEYS.length;

type Props = {
  itinerary: ReactNode;
  expenses: ReactNode;
  chat: ReactNode;
  docs: ReactNode;
  guides: ReactNode;
  members: ReactNode;
};

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

  /** Tab bar + aria follow scroll position immediately; URL updates in the background. */
  const [displayIndex, setDisplayIndex] = useState(urlIndex);
  const [isScrollerReady, setIsScrollerReady] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const scrollIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);
  const previousDisplayIndexRef = useRef(displayIndex);
  const isInitialUrlAlignmentDoneRef = useRef(false);
  const initialAlignRafRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartIndexRef = useRef<number>(displayIndex);
  const [activePanelHeight, setActivePanelHeight] = useState<number | null>(null);

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

  /** Align scroller + highlight when URL changes (deep link, back/forward, external replace). */
  useLayoutEffect(() => {
    setDisplayIndex(urlIndex);
    setIsScrollerReady(false);
    isInitialUrlAlignmentDoneRef.current = false;
    const el = scrollerRef.current;
    if (!el) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;

    const alignToUrl = (): boolean => {
      if (cancelled) return true;
      const w = el.clientWidth;
      if (w <= 0) return false;

      const target = urlIndex * w;
      const delta = Math.abs(el.scrollLeft - target);
      if (delta >= 2) {
        isProgrammaticScroll.current = true;
        el.scrollLeft = target;
        requestAnimationFrame(() => {
          isProgrammaticScroll.current = false;
        });
        return false;
      }
      isInitialUrlAlignmentDoneRef.current = true;
      setIsScrollerReady(true);
      return true;
    };

    const tick = () => {
      if (alignToUrl()) return;
      attempts += 1;
      if (attempts >= maxAttempts) {
        // Do not block UI forever; use best effort and allow render.
        isInitialUrlAlignmentDoneRef.current = true;
        setIsScrollerReady(true);
        return;
      }
      initialAlignRafRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      cancelled = true;
      if (initialAlignRafRef.current != null) {
        cancelAnimationFrame(initialAlignRafRef.current);
        initialAlignRafRef.current = null;
      }
    };
  }, [urlIndex, pathname]);

  /** Reset vertical page position immediately when active panel changes. */
  useEffect(() => {
    const previous = previousDisplayIndexRef.current;
    previousDisplayIndexRef.current = displayIndex;
    if (previous === displayIndex) return;

    const appShellScrollRoot = document.getElementById("app-shell-scroll-root");
    if (appShellScrollRoot) {
      appShellScrollRoot.scrollTo({ top: 0, behavior: "auto" });
      appShellScrollRoot.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [displayIndex]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const readIndexFromScroll = () => {
      if (!isInitialUrlAlignmentDoneRef.current) return;
      const w = el.clientWidth;
      if (w <= 0) return;
      const idx = Math.round(el.scrollLeft / w);
      const clamped = Math.max(0, Math.min(TAB_COUNT - 1, idx));
      setDisplayIndex((prev) => (prev !== clamped ? clamped : prev));
    };

    const flushScrollToUrl = () => {
      if (!isInitialUrlAlignmentDoneRef.current) return;
      if (isProgrammaticScroll.current) return;
      const w = el.clientWidth;
      if (w <= 0) return;
      const idx = Math.round(el.scrollLeft / w);
      const clamped = Math.max(0, Math.min(TAB_COUNT - 1, idx));
      const key = TRIP_TAB_KEYS[clamped]!;
      const current = parseTripTabParam(searchParams.get("tab"));
      if (key !== current) {
        replaceTab(key);
      }
    };

    const onScroll = () => {
      if (!isProgrammaticScroll.current) {
        if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = requestAnimationFrame(() => {
          scrollRafRef.current = null;
          readIndexFromScroll();
        });
      }
      if (scrollIdleRef.current) clearTimeout(scrollIdleRef.current);
      scrollIdleRef.current = setTimeout(flushScrollToUrl, 48);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollIdleRef.current) clearTimeout(scrollIdleRef.current);
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [replaceTab, searchParams]);

  useEffect(() => {
    const btn = tabBtnRefs.current[displayIndex];
    const bar = tabBarRef.current;
    if (!btn || !bar) return;
    const gr = bar.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    if (br.left < gr.left + 8) {
      bar.scrollTo({ left: bar.scrollLeft + (br.left - gr.left) - 16, behavior: "smooth" });
    } else if (br.right > gr.right - 8) {
      bar.scrollTo({ left: bar.scrollLeft + (br.right - gr.right) + 16, behavior: "smooth" });
    }
  }, [displayIndex]);

  const goToIndex = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(TAB_COUNT - 1, i));
      const key = TRIP_TAB_KEYS[clamped]!;
      setDisplayIndex(clamped);
      replaceTab(key);

      const el = scrollerRef.current;
      if (el?.clientWidth) {
        isProgrammaticScroll.current = true;
        el.scrollTo({ left: clamped * el.clientWidth, behavior: "auto" });
        requestAnimationFrame(() => {
          isProgrammaticScroll.current = false;
        });
      }
    },
    [replaceTab],
  );

  const onTabClick = (i: number) => {
    goToIndex(i);
  };

  const activeTabKey: TripTabKey = TRIP_TAB_KEYS[displayIndex] ?? "itinerary";
  const scrollerHeightStyle = useMemo(
    () => (activePanelHeight != null ? { height: `${activePanelHeight}px` } : undefined),
    [activePanelHeight],
  );

  useLayoutEffect(() => {
    const activePanel = panelRefs.current[displayIndex];
    if (!activePanel) return;

    const updateHeight = () => {
      const next = Math.ceil(activePanel.getBoundingClientRect().height);
      if (next > 0) setActivePanelHeight(next);
    };

    updateHeight();

    const ro = new ResizeObserver(() => {
      updateHeight();
    });
    ro.observe(activePanel);

    return () => {
      ro.disconnect();
    };
  }, [displayIndex, panels]);

  return (
    <TripActiveTabProvider activeTab={activeTabKey}>
      <TripFabRegistryProvider activeTab={activeTabKey}>
        <div className="flex w-full max-w-md flex-col self-center">
          <nav
            ref={tabBarRef}
            className="scrollbar-hide sticky top-0 z-[115] -mx-4 flex gap-0.5 overflow-x-auto border-b border-slate-200/90 bg-white/95 px-3 pb-0 pt-1 backdrop-blur-md supports-[backdrop-filter]:bg-white/90"
            aria-label="Trip sections"
          >
            {TRIP_TAB_KEYS.map((key, i) => {
              const active = i === displayIndex;
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
                  onClick={() => onTabClick(i)}
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

          <div className="w-full">
            <div
              ref={scrollerRef}
              className={`flex w-full snap-x snap-mandatory items-start overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                isScrollerReady ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              style={{ WebkitOverflowScrolling: "touch", ...scrollerHeightStyle }}
              aria-label="Swipe between trip sections"
              onTouchStart={(e) => {
                const t = e.changedTouches[0];
                if (!t) return;
                touchStartXRef.current = t.clientX;
                touchStartYRef.current = t.clientY;
                touchStartIndexRef.current = displayIndex;
              }}
              onTouchEnd={(e) => {
                const sx = touchStartXRef.current;
                const sy = touchStartYRef.current;
                const t = e.changedTouches[0];
                touchStartXRef.current = null;
                touchStartYRef.current = null;
                if (sx == null || sy == null || !t) return;

                const dx = t.clientX - sx;
                const dy = t.clientY - sy;
                const absX = Math.abs(dx);
                const absY = Math.abs(dy);
                const minSwipePx = 26;
                const horizontalDominance = 1.15;

                if (absX < minSwipePx || absX < absY * horizontalDominance) return;

                const step = dx < 0 ? 1 : -1;
                const nextIndex = touchStartIndexRef.current + step;
                goToIndex(nextIndex);
              }}
            >
              {panels.map((panel, i) => {
                const key = TRIP_TAB_KEYS[i]!;
                return (
                  <section
                    key={key}
                    ref={(el) => {
                      panelRefs.current[i] = el;
                    }}
                    id={`trip-panel-${key}`}
                    role="tabpanel"
                    aria-labelledby={`trip-tab-${key}`}
                    aria-hidden={i !== displayIndex}
                    className="box-border w-full min-w-full max-w-full shrink-0 snap-center snap-always touch-manipulation px-4 py-4 pb-28"
                  >
                    {panel}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </TripFabRegistryProvider>
    </TripActiveTabProvider>
  );
}
