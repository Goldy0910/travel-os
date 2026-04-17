export type TripForexOption = {
  id: string;
  title: string;
  destination: string;
};

export type ForexRateResponse = {
  base: string;
  rateToInr: number;
  lastUpdatedIso: string;
  source: "live" | "fallback";
};

export type ForexTransaction = {
  id: string;
  amount: number;
  currency: string;
  inr: number;
  createdAtIso: string;
};

export type ForexPlace = {
  id: string;
  name: string;
  address: string;
  mapsUrl: string;
  rating: number | null;
  userRatingCount: number;
  openNow: boolean | null;
};
