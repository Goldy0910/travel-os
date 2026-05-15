export type TripDurationPreset = "weekend" | "3-days" | "5-days" | "1-week" | "custom";

export type TripPriority =
  | "relaxing"
  | "scenic"
  | "adventure"
  | "food-culture"
  | "budget-friendly"
  | "easy-to-reach";

export type BudgetTier = "budget" | "moderate" | "premium";

export type HomepageDecisionRequest = {
  days: number;
  durationPreset: TripDurationPreset;
  priorities: TripPriority[];
  destination?: string;
  originCity?: string;
  budget?: BudgetTier;
  customDays?: number;
  travelMonth?: number;
};

export type RecommendationPayload = {
  mode: "recommendation";
  destination: string;
  destinationSlug: string | null;
  canonicalLocation: string;
  whyItFits: string[];
  travelEffort: string;
  budgetEstimate: string;
  itinerary: string[];
  alternatives: Array<{ name: string; slug: string | null; reason: string }>;
};

export type ValidationFit = "strong" | "okay" | "weak";

export type ValidationPayload = {
  mode: "validation";
  destination: string;
  destinationSlug: string | null;
  fit: ValidationFit;
  summary: string;
  travelEffort: string;
  practicality: string;
  timeFit: string;
  budgetRealism: string;
  alternatives: Array<{ name: string; slug: string | null; reason: string }>;
};

export type HomepageDecisionResponse = RecommendationPayload | ValidationPayload;

export type HomepageDecisionApiResult =
  | { ok: true; data: HomepageDecisionResponse; source: "ai" | "rules" }
  | { ok: false; error: string };
