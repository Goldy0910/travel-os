import type {
  BudgetTier,
  HomepageDecisionResponse,
  TripDurationPreset,
  TripPriority,
} from "@/lib/homepage-decision/types";
import type { MasterTripPreferences } from "@/lib/master-trip-file/types";

export const RECOMMENDATION_SESSION_KEY = "traveltill99-recommendation-session";
export const RECOMMENDATION_SESSION_VERSION = 1 as const;

export type RecommendationContinuationIntent = "continue-planning" | "create-trip-only";

export type RecommendationFormState = {
  duration: TripDurationPreset;
  customDays: number;
  priorities: TripPriority[];
  destination: string;
  budget: BudgetTier | null;
  originCity: string;
};

export type RecommendationSession = {
  version: typeof RECOMMENDATION_SESSION_VERSION;
  savedAt: number;
  intent: RecommendationContinuationIntent;
  decision: HomepageDecisionResponse;
  preferences: MasterTripPreferences;
  form: RecommendationFormState;
};
