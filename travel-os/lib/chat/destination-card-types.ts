export type BudgetTier = "budget" | "moderate" | "premium";

/** Inline chat destination recommendation card (conversation-scoped, no trip). */
export type ChatDestinationCard = {
  id: string;
  slug: string;
  name: string;
  country: string;
  heroImageUrl: string;
  budgetTier: BudgetTier;
  budgetLabel: string;
  weather: string;
  visa: string;
  flightDuration: string;
  bestMonths: string[];
  highlights: string[];
  matchNote?: string;
  /** Expert mode (optional — backward compatible). */
  matchScore?: number;
  role?: "primary" | "alternative";
  whyReasons?: string[];
  rankedLowerReasons?: string[];
  chooseIf?: string[];
  expertOpinion?: string;
  uniqueTravelers?: number;
  totalInterest?: number;
  month?: number;
};

export type ChatRecommendationsPayload = {
  cards: ChatDestinationCard[];
  source: "discovery" | "expert";
};
