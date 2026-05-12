export const AI_INTENT_TYPES = [
  "adjust_day",
  "recommendation",
  "logistics",
  "optimization",
  "exploration",
  "conversational",
] as const;
export type AiIntentType = (typeof AI_INTENT_TYPES)[number];
export type ActivityState = "pending" | "completed" | "skipped" | "delayed" | "replaced" | "planned";
export type OptimizationActionType =
  | "reorder"
  | "replace"
  | "insert_break"
  | "shorten"
  | "delay"
  | "transport_swap";
export type OptimizationAction = {
  type: OptimizationActionType;
  activityId?: string;
  targetActivityId?: string;
  reason: string;
  confidence: number;
};
export type ItineraryRevision = {
  day: string;
  activityId?: string;
  title: string;
  location?: string | null;
  time?: string | null;
  state?: ActivityState;
  notes?: string | null;
};
export type AiAction = {
  type: "inform" | "question" | "revise_itinerary" | "logistics_tip" | "budget_alert";
  label: string;
  payload?: Record<string, unknown>;
};
export type AiStructuredResponse = {
  message: string;
  actions: AiAction[];
  updatedItinerary: ItineraryRevision[];
  reasoning: string;
  followUpQuestion: string;
};
export type TravelerPreferences = {
  interests?: string[];
  pace?: "relaxed" | "balanced" | "packed";
  foodPreferences?: string[];
  accessibilityNeeds?: string[];
};
export type ContextActivity = {
  id?: string;
  title: string;
  location?: string | null;
  time?: string | null;
  notes?: string | null;
  state?: ActivityState;
  estimatedDurationMinutes?: number;
  estimatedCost?: number;
};
export type AiTripContext = {
  tripId: string;
  tripTitle: string;
  destination: string;
  currentDay: string | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  completedActivities: ContextActivity[];
  skippedActivities: ContextActivity[];
  travelerPreferences: TravelerPreferences;
  currentTimeIso: string;
  cityOrLocation: string;
  weather: { summary: string; temperatureC?: number };
  budget: { currency?: string; remaining?: number; level?: "low" | "mid" | "high" | "unknown" };
  transportMode: "walking" | "public_transport" | "ride_hailing" | "mixed" | "unknown";
};
export type BuildAiContextInput = {
  tripId: string;
  tripTitle?: string | null;
  destination?: string | null;
  currentDay?: string | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  activities?: ContextActivity[];
  travelerPreferences?: TravelerPreferences;
  currentTime?: Date;
  cityOrLocation?: string | null;
  weatherPlaceholder?: string;
  budget?: AiTripContext["budget"];
  transportMode?: AiTripContext["transportMode"];
};
export type AiExecutionState =
  | { status: "idle" | "loading" }
  | { status: "success"; response: AiStructuredResponse }
  | { status: "error"; message: string; fallbackResponse?: AiStructuredResponse };

export type ItineraryActivityStatus = "pending" | "completed" | "skipped" | "delayed" | "replaced";
