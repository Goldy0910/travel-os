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
};

export type ChatRecommendationsPayload = {
  cards: ChatDestinationCard[];
  source: "discovery";
};
