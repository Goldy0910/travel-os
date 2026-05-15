import type { BudgetTier, TripDurationPreset, TripPriority } from "@/lib/homepage-decision/types";

export const DURATION_OPTIONS: { id: TripDurationPreset; label: string; days: number }[] = [
  { id: "weekend", label: "Weekend", days: 2 },
  { id: "3-days", label: "3 Days", days: 3 },
  { id: "5-days", label: "5 Days", days: 5 },
  { id: "1-week", label: "1 Week", days: 7 },
  { id: "custom", label: "Custom", days: 5 },
];

export const PRIORITY_CHIPS: { id: TripPriority; label: string }[] = [
  { id: "relaxing", label: "Relaxing" },
  { id: "scenic", label: "Scenic" },
  { id: "adventure", label: "Adventure" },
  { id: "food-culture", label: "Food & Culture" },
  { id: "budget-friendly", label: "Budget-Friendly" },
  { id: "easy-to-reach", label: "Easy to Reach" },
];

export const BUDGET_OPTIONS: { id: BudgetTier; label: string }[] = [
  { id: "budget", label: "Budget" },
  { id: "moderate", label: "Moderate" },
  { id: "premium", label: "Premium" },
];

export const HOMEPAGE_DRAFT_KEY = "traveltill99-homepage-draft";

export const ORIGIN_CITY_OPTIONS = [
  { id: "mumbai", label: "Mumbai" },
  { id: "delhi", label: "Delhi" },
  { id: "bangalore", label: "Bangalore" },
  { id: "hyderabad", label: "Hyderabad" },
  { id: "chennai", label: "Chennai" },
  { id: "kolkata", label: "Kolkata" },
  { id: "pune", label: "Pune" },
] as const;
