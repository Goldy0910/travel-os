"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import TripFabAnchor from "@/app/app/trip/[id]/_components/trip-fab-anchor";
import type { ConnectSection, TripTabKey } from "./trip-tab-keys";

type OpenFn = (() => void) | null;

type RegistryContextValue = {
  setOpenActivity: (fn: OpenFn) => void;
  setOpenExpense: (fn: OpenFn) => void;
  setOpenUpload: (fn: OpenFn) => void;
  triggerAddActivity: () => void;
};

const TripFabRegistryContext = createContext<RegistryContextValue | null>(null);

export function useTripFabRegistry(): RegistryContextValue {
  const ctx = useContext(TripFabRegistryContext);
  if (!ctx) {
    throw new Error("useTripFabRegistry must be used within TripFabRegistryProvider");
  }
  return ctx;
}

export function TripFabRegistryProvider({
  activeTab,
  connectSection,
  children,
}: {
  activeTab: TripTabKey;
  /** When `activeTab === "connect"`, which sub-panel is visible (for upload FAB). */
  connectSection?: ConnectSection | null;
  children: ReactNode;
}) {
  const openActivityRef = useRef<OpenFn>(null);
  const openExpenseRef = useRef<OpenFn>(null);
  const openUploadRef = useRef<OpenFn>(null);
  const activeTabRef = useRef(activeTab);
  useLayoutEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const setOpenActivity = useCallback((fn: OpenFn) => {
    openActivityRef.current = fn;
  }, []);
  const setOpenExpense = useCallback((fn: OpenFn) => {
    openExpenseRef.current = fn;
  }, []);
  const setOpenUpload = useCallback((fn: OpenFn) => {
    openUploadRef.current = fn;
  }, []);

  const triggerAddActivity = useCallback(() => {
    openActivityRef.current?.();
  }, []);

  const onFabPress = useCallback(() => {
    const t = activeTabRef.current;
    if (t === "itinerary") triggerAddActivity();
    else if (t === "expenses") openExpenseRef.current?.();
    // FAB is only shown for Connect when the Docs segment is active (`docsFab`); no second gate on refs.
    else if (t === "connect") openUploadRef.current?.();
  }, [triggerAddActivity]);

  const ctx = useMemo(
    () => ({ setOpenActivity, setOpenExpense, setOpenUpload, triggerAddActivity }),
    [setOpenActivity, setOpenExpense, setOpenUpload, triggerAddActivity],
  );

  const docsFab =
    activeTab === "connect" && (connectSection ?? "chat") === "docs";

  const showFab = docsFab;

  const fabLabel =
    activeTab === "itinerary"
      ? "Add activity"
      : activeTab === "expenses"
        ? "Add expense"
        : "Upload document";

  return (
    <TripFabRegistryContext.Provider value={ctx}>
      {children}
      {showFab ? (
        <TripFabAnchor bottomClassName="bottom-[var(--travel-os-fab-bottom)]" zClassName="z-[110]">
          <button
            type="button"
            aria-label={fabLabel}
            onClick={onFabPress}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-900 text-2xl font-light leading-none text-white shadow-lg shadow-slate-900/30 transition hover:bg-slate-800 active:scale-95 touch-manipulation"
          >
            +
          </button>
        </TripFabAnchor>
      ) : null}
    </TripFabRegistryContext.Provider>
  );
}
