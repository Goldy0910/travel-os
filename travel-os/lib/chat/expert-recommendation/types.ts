import type { ChatDestinationCard } from "@/lib/chat/destination-card-types";

/** Normalized preference signals used by expert scoring (from chat memory or quiz). */
export type ExpertPreferenceSignals = {
  budgetInr?: number | null;
  budgetLabel?: string | null;
  durationDays?: number | null;
  durationLabel?: string | null;
  interests: string[];
  weather?: string | null;
  groupType?: string | null;
  region?: "india" | "international" | "surprise" | null;
  travelStyle?: string | null;
  foodPreferences?: string[];
  visaPreference?: string | null;
  travelMonth?: string | null;
  /** Destination the user explicitly asked about (may not be the primary pick). */
  mentionedDestination?: string | null;
};

export type ExpertScoreBreakdown = {
  interests: number;
  budget: number;
  weather: number;
  tripDuration: number;
  safety: number;
  accessibility: number;
  crowdLevel: number;
  valueForMoney: number;
  total: number;
};

export type ExpertRankedDestination = {
  slug: string;
  name: string;
  country: string;
  matchScore: number;
  summary: string;
  whyReasons: string[];
  rankedLowerReasons: string[];
  chooseIf: string[];
  /** Comparison dimensions for the quick table (short labels). */
  comparison: {
    budget: string;
    weather: string;
    activities: string;
    food: string;
    safety: string;
  };
  role: "primary" | "alternative";
};

export type ExpertRecommendationResult = {
  primary: ExpertRankedDestination;
  alternatives: ExpertRankedDestination[];
  expertOpinion: string;
  /** Present when user asked about a destination that is not the primary pick. */
  whyNotUserChoice?: string | null;
  comparisonRows: Array<{
    destination: string;
    budget: string;
    weather: string;
    activities: string;
    food: string;
    safety: string;
    overallMatch: number;
  }>;
};

export type ExpertChatDestinationCard = ChatDestinationCard & {
  matchScore?: number;
  role?: "primary" | "alternative";
  whyReasons?: string[];
  rankedLowerReasons?: string[];
  chooseIf?: string[];
  expertOpinion?: string;
};
