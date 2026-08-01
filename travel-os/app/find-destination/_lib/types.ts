export type CompanionOption =
  | "solo"
  | "couple"
  | "friends"
  | "family"
  | "parents"
  | "office";

export type DurationOption =
  | "weekend"
  | "3-5-days"
  | "1-week"
  | "2-weeks"
  | "more-than-2-weeks";

export type WeatherOption =
  | "snow"
  | "cold"
  | "pleasant"
  | "warm"
  | "beach"
  | "any";

export type InterestOption =
  | "beaches"
  | "mountains"
  | "adventure"
  | "wildlife"
  | "food"
  | "nightlife"
  | "shopping"
  | "history"
  | "spiritual"
  | "photography"
  | "road-trips"
  | "hidden-gems"
  | "luxury"
  | "relaxation";

export type RegionPreference = "india" | "international" | "surprise";

export type TravelStyleOption = "relaxing" | "moderate" | "active";

export type TransportOption = "flights" | "road" | "train" | "any";

export type TravelPreference = {
  companion: CompanionOption;
  budgetInr: number;
  duration: DurationOption;
  weather: WeatherOption;
  interests: InterestOption[];
  region: RegionPreference;
  travelStyle: TravelStyleOption;
  transport: TransportOption;
};

export type QuizAnswers = TravelPreference;

export type DestinationRecommendation = {
  slug: string;
  name: string;
  country: string;
  shortDescription: string;
  whyItMatches: string;
  bestMonths: string[];
  estimatedBudgetInr: { min: number; max: number };
  idealDuration: string;
  topAttractions: string[];
  travelStyle: string;
  confidenceScore: number;
  imageSearchKeyword: string;
  imageUrl: string;
  region: "india" | "international";
  weatherSummary: string;
  foodHighlights: string[];
  transportNotes: string;
  packingTips: string[];
  travelTips: string[];
  safetyNotes: string;
  overview: string;
  /** Optional curated create-trip slug when available */
  travelPlaceSlug?: string;
};

export type RecommendationResponse = {
  destinations: DestinationRecommendation[];
  generatedAt: string;
  source: "gemini" | "mock";
};
