"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

type Ctx = {
  registerOpenAssistant: (fn: (() => void) | null) => void;
  openAssistant: () => void;
};

const TripItineraryAssistantContext = createContext<Ctx | null>(null);

export function TripItineraryAssistantProvider({ children }: { children: ReactNode }) {
  const openRef = useRef<(() => void) | null>(null);

  const registerOpenAssistant = useCallback((fn: (() => void) | null) => {
    openRef.current = fn;
  }, []);

  const openAssistant = useCallback(() => {
    openRef.current?.();
  }, []);

  const value = useMemo(
    () => ({ registerOpenAssistant, openAssistant }),
    [registerOpenAssistant, openAssistant],
  );

  return (
    <TripItineraryAssistantContext.Provider value={value}>
      {children}
    </TripItineraryAssistantContext.Provider>
  );
}

export function useTripItineraryAssistant() {
  const ctx = useContext(TripItineraryAssistantContext);
  if (!ctx) {
    throw new Error("useTripItineraryAssistant must be used within TripItineraryAssistantProvider");
  }
  return ctx;
}

export function useTripItineraryAssistantOptional() {
  return useContext(TripItineraryAssistantContext);
}
