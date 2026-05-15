"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

export type RunRefinementFn = (text: string, quickActionId?: string) => void;

type RefinementContextValue = {
  registerRunRefinement: (fn: RunRefinementFn | null) => void;
  runQuickAction: (quickActionId: string, prompt: string) => void;
  openRefinement: () => void;
  registerOpenRefinement: (fn: (() => void) | null) => void;
};

const ItineraryRefinementContext = createContext<RefinementContextValue | null>(null);

export function ItineraryRefinementProvider({ children }: { children: ReactNode }) {
  const runRef = useRef<RunRefinementFn | null>(null);
  const openRef = useRef<(() => void) | null>(null);

  const registerRunRefinement = useCallback((fn: RunRefinementFn | null) => {
    runRef.current = fn;
  }, []);

  const registerOpenRefinement = useCallback((fn: (() => void) | null) => {
    openRef.current = fn;
  }, []);

  const runQuickAction = useCallback((quickActionId: string, prompt: string) => {
    openRef.current?.();
    runRef.current?.(prompt, quickActionId);
  }, []);

  const openRefinement = useCallback(() => {
    openRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      registerRunRefinement,
      runQuickAction,
      openRefinement,
      registerOpenRefinement,
    }),
    [registerRunRefinement, runQuickAction, openRefinement, registerOpenRefinement],
  );

  return (
    <ItineraryRefinementContext.Provider value={value}>
      {children}
    </ItineraryRefinementContext.Provider>
  );
}

export function useItineraryRefinement() {
  const ctx = useContext(ItineraryRefinementContext);
  if (!ctx) {
    throw new Error("useItineraryRefinement must be used within ItineraryRefinementProvider");
  }
  return ctx;
}

export function useItineraryRefinementOptional() {
  return useContext(ItineraryRefinementContext);
}
