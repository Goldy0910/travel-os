import type {
  BudgetTier,
  HomepageDecisionResponse,
  TripDurationPreset,
  TripPriority,
} from "@/lib/homepage-decision/types";

export const MASTER_TRIP_FILE_SCHEMA_VERSION = 1 as const;

export type MasterItineraryDay = {
  id: string;
  dayNumber: number;
  title: string;
  summary: string;
};

export type MasterTripPreferences = {
  days: number;
  durationPreset?: TripDurationPreset;
  priorities: TripPriority[];
  budget?: BudgetTier;
  originCity?: string;
  travelMonth?: number;
};

export type MasterDestination = {
  name: string;
  slug: string | null;
  canonicalLocation: string;
  country?: string;
  state?: string;
};

export type MasterRecommendationSnapshot = {
  mode: "recommendation" | "validation";
  fitScore?: number;
  fit?: "strong" | "moderate" | "weak" | "okay";
  whyItFits: string[];
  explanation: string;
  summary?: string;
  travelEffort: string;
  budgetEstimate: string;
  practicality?: string;
  timeFit?: string;
  budgetRealism?: string;
  alternatives: Array<{ name: string; slug: string | null; reason: string }>;
};

export type MasterPracticalSnapshot = {
  travelEffort: string;
  budgetEstimate: string;
  timeFit?: string;
  practicality?: string;
  budgetRealism?: string;
};

export type RefinementHistoryEntry = {
  id: string;
  at: string;
  note: string;
  preferences: MasterTripPreferences;
};

export type EditHistoryEntry = {
  id: string;
  at: string;
  section: "itinerary" | "whyItFits" | "practical" | "preferences" | "destination";
  summary: string;
};

export type MasterRefinementChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  quickActionId?: string;
  affectedSections?: string[];
};

export type MasterTripFile = {
  schemaVersion: typeof MASTER_TRIP_FILE_SCHEMA_VERSION;
  preferences: MasterTripPreferences;
  destination: MasterDestination;
  recommendation: MasterRecommendationSnapshot;
  itinerary: MasterItineraryDay[];
  practical: MasterPracticalSnapshot;
  refinementHistory: RefinementHistoryEntry[];
  edits: EditHistoryEntry[];
  /** Conversational refinement thread (partial patches only). */
  refinementChat?: {
    messages: MasterRefinementChatMessage[];
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    source: "homepage" | "create-trip" | "manual";
  };
};

export type MasterTripFileRow = {
  id: string;
  user_id: string;
  trip_id: string | null;
  version: number;
  data: MasterTripFile;
  created_at: string;
  updated_at: string;
};

export type SaveMasterTripInput = {
  decision: HomepageDecisionResponse;
  preferences: MasterTripPreferences;
  travelPlaceSlug?: string | null;
  source?: MasterTripFile["metadata"]["source"];
};
