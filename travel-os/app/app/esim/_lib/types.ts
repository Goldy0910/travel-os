export type UsageType = "Light" | "Medium" | "Heavy";
export type DurationDays = 3 | 7 | 14;
export type CoverageQuality = "Excellent" | "Good" | "Average";

export type CarrierPlan = {
  id: string;
  name: string;
  data: string;
  validityDays: number;
  priceInr: number;
};

export type CarrierGuide = {
  carrier: string;
  coverage: CoverageQuality;
  bestOption?: boolean;
  plans: CarrierPlan[];
  rechargeMethods: Array<"App" | "USSD" | "Stores">;
  airportPriceInr: number;
  cityPriceInr: number;
};

export type EsimProviderPlan = {
  provider: string;
  data: string;
  validityDays: number;
  priceInr: number;
  purchaseUrl: string;
};

export type SimConnectivityBundle = {
  city: string;
  country: string;
  topCarriers: CarrierGuide[];
  esimProviders: EsimProviderPlan[];
  smartInsights: string[];
  updatedAtIso: string;
};

export type EsimTripOption = {
  id: string;
  title: string;
  destination: string;
};
