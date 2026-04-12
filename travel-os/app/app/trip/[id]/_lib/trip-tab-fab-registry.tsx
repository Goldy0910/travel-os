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
import type { TripTabKey } from "./trip-tab-keys";

type OpenFn = (() => void) | null;

type RegistryContextValue = {
  setOpenActivity: (fn: OpenFn) => void;
  setOpenExpense: (fn: OpenFn) => void;
  setOpenUpload: (fn: OpenFn) => void;
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
  children,
}: {
  activeTab: TripTabKey;
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

  const onFabPress = useCallback(() => {
    const t = activeTabRef.current;
    if (t === "itinerary") openActivityRef.current?.();
    else if (t === "expenses") openExpenseRef.current?.();
    else if (t === "docs") openUploadRef.current?.();
  }, []);

  const ctx = useMemo(
    () => ({ setOpenActivity, setOpenExpense, setOpenUpload }),
    [setOpenActivity, setOpenExpense, setOpenUpload],
  );

  const showFab =
    activeTab === "itinerary" ||
    activeTab === "expenses" ||
    activeTab === "docs";

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
        <button
          type="button"
          aria-label={fabLabel}
          onClick={onFabPress}
          className="fixed bottom-[var(--travel-os-fab-bottom)] right-[max(1rem,env(safe-area-inset-right,0px))] z-[110] flex h-14 w-14 min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-900 text-2xl font-light leading-none text-white shadow-lg shadow-slate-900/30 transition hover:bg-slate-800 active:scale-95"
        >
          +
        </button>
      ) : null}
    </TripFabRegistryContext.Provider>
  );
}
