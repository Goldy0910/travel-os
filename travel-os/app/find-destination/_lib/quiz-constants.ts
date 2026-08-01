import type {
  CompanionOption,
  DurationOption,
  InterestOption,
  RegionPreference,
  TransportOption,
  TravelStyleOption,
  WeatherOption,
} from "./types";

export const QUIZ_TOTAL_STEPS = 8;

export const COMPANION_OPTIONS: Array<{ id: CompanionOption; label: string }> = [
  { id: "solo", label: "Solo" },
  { id: "couple", label: "Couple" },
  { id: "friends", label: "Friends" },
  { id: "family", label: "Family" },
  { id: "parents", label: "Parents" },
  { id: "office", label: "Office Team" },
];

export const DURATION_OPTIONS: Array<{ id: DurationOption; label: string }> = [
  { id: "weekend", label: "Weekend" },
  { id: "3-5-days", label: "3–5 Days" },
  { id: "1-week", label: "1 Week" },
  { id: "2-weeks", label: "2 Weeks" },
  { id: "more-than-2-weeks", label: "More than 2 Weeks" },
];

export const WEATHER_OPTIONS: Array<{ id: WeatherOption; label: string }> = [
  { id: "snow", label: "Snow" },
  { id: "cold", label: "Cold" },
  { id: "pleasant", label: "Pleasant" },
  { id: "warm", label: "Warm" },
  { id: "beach", label: "Beach Weather" },
  { id: "any", label: "Doesn't Matter" },
];

export const INTEREST_OPTIONS: Array<{ id: InterestOption; label: string }> = [
  { id: "beaches", label: "Beaches" },
  { id: "mountains", label: "Mountains" },
  { id: "adventure", label: "Adventure" },
  { id: "wildlife", label: "Wildlife" },
  { id: "food", label: "Food" },
  { id: "nightlife", label: "Nightlife" },
  { id: "shopping", label: "Shopping" },
  { id: "history", label: "History" },
  { id: "spiritual", label: "Spiritual" },
  { id: "photography", label: "Photography" },
  { id: "road-trips", label: "Road Trips" },
  { id: "hidden-gems", label: "Hidden Gems" },
  { id: "luxury", label: "Luxury" },
  { id: "relaxation", label: "Relaxation" },
];

export const REGION_OPTIONS: Array<{ id: RegionPreference; label: string }> = [
  { id: "india", label: "India" },
  { id: "international", label: "International" },
  { id: "surprise", label: "Surprise Me" },
];

export const TRAVEL_STYLE_OPTIONS: Array<{ id: TravelStyleOption; label: string }> = [
  { id: "relaxing", label: "Relaxing" },
  { id: "moderate", label: "Moderate" },
  { id: "active", label: "Active" },
];

export const TRANSPORT_OPTIONS: Array<{ id: TransportOption; label: string }> = [
  { id: "flights", label: "Flights" },
  { id: "road", label: "Road Trip" },
  { id: "train", label: "Train" },
  { id: "any", label: "Doesn't Matter" },
];

export const BUDGET_MIN = 10_000;
export const BUDGET_MAX = 300_000;
export const BUDGET_STEP = 5_000;

export const LOADING_STEPS = [
  "Searching destinations...",
  "Checking weather...",
  "Matching interests...",
  "Comparing budgets...",
  "Almost there...",
] as const;

export function formatBudgetInr(value: number): string {
  if (value >= BUDGET_MAX) return "₹3,00,000+";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
