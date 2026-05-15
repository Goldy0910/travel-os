import type { BudgetTier, TravelEffortLevel, TripStyle } from "../types";

export type DestinationScores = {
  relaxation: number;
  adventure: number;
  accessibility: number;
  foodCulture: number;
  scenic: number;
};

/** How easy to reach from a known origin city slug (see origin-cities.seed). */
export type OriginReach = "easy" | "moderate" | "hard";

export type DestinationMetadata = {
  slug: string;
  name: string;
  country: string;
  state?: string;
  canonicalLocation: string;
  tripStyles: TripStyle[];
  idealDuration: { min: number; ideal: number; max: number };
  budgetLevel: BudgetTier;
  bestMonths: number[];
  travelEffort: TravelEffortLevel;
  weatherTags: string[];
  scores: DestinationScores;
  aliases: string[];
  /** Per origin-city slug reach difficulty. Omitted origins use region heuristics. */
  reachFromOrigins: Partial<Record<string, OriginReach>>;
  /** Domestic India destinations are generally easier from any Indian origin. */
  domesticIndia: boolean;
};
