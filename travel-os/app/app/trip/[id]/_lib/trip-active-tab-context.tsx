"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { TripTabKey } from "./trip-tab-keys";

const TripActiveTabContext = createContext<TripTabKey>("itinerary");

export function TripActiveTabProvider({
  activeTab,
  children,
}: {
  activeTab: TripTabKey;
  children: ReactNode;
}) {
  return (
    <TripActiveTabContext.Provider value={activeTab}>
      {children}
    </TripActiveTabContext.Provider>
  );
}

export function useTripActiveTab(): TripTabKey {
  return useContext(TripActiveTabContext);
}
