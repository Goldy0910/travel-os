import type { BudgetTier, TripPriority } from "@/lib/homepage-decision/types";
import type { DestinationMetadata } from "./models/destination";

export type { BudgetTier, TripPriority };

export type TravelEffortLevel = "low" | "medium" | "high";

export type FitLevel = "strong" | "moderate" | "weak";

export type TripStyle =
  | "beach"
  | "hill-station"
  | "heritage"
  | "adventure"
  | "wildlife"
  | "spiritual"
  | "city-break"
  | "island";

/** User preferences passed into the engine. */
export type TripPreferences = {
  days: number;
  priorities: TripPriority[];
  budget?: BudgetTier;
  originCity?: string;
  destination?: string;
  travelMonth?: number;
};

export type ScoreBreakdown = {
  timeFit: number;
  budgetFit: number;
  preferenceAlignment: number;
  travelPracticality: number;
  seasonalFit: number;
  effortPenalty: number;
  total: number;
};

export type ScoredDestination = {
  destination: DestinationMetadata;
  score: number;
  breakdown: ScoreBreakdown;
  explanations: string[];
};

export type AlternativePick = {
  name: string;
  slug: string;
  reason: string;
  fitScore: number;
};

export type RecommendationResult = {
  mode: "recommendation";
  destination: string;
  destinationSlug: string;
  canonicalLocation: string;
  country: string;
  state?: string;
  fitScore: number;
  scoreBreakdown: ScoreBreakdown;
  explanation: string;
  whyItFits: string[];
  travelEffort: string;
  budgetEstimate: string;
  itinerary: string[];
  alternatives: AlternativePick[];
  ranking: Array<{ slug: string; name: string; fitScore: number }>;
};

export type ValidationResult = {
  mode: "validation";
  destination: string;
  destinationSlug: string | null;
  fit: FitLevel;
  fitScore: number;
  scoreBreakdown: ScoreBreakdown;
  explanation: string;
  summary: string;
  travelEffort: string;
  practicality: string;
  timeFit: string;
  budgetRealism: string;
  alternatives: AlternativePick[];
};

export type EngineResult = RecommendationResult | ValidationResult;
