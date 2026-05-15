import type {
  MasterItineraryDay,
  MasterTripFile,
  MasterTripPreferences,
  MasterPracticalSnapshot,
} from "@/lib/master-trip-file/types";
import type { TripPriority } from "@/lib/homepage-decision/types";

export type RefinableSection =
  | "preferences"
  | "itinerary"
  | "practical"
  | "whyItFits"
  | "recommendation";

export type ItineraryPatchOp =
  | { op: "update"; dayId: string; summary?: string; title?: string }
  | { op: "add"; dayNumber: number; summary: string; title?: string }
  | { op: "remove"; dayId: string }
  | { op: "truncate"; maxDays: number }
  | { op: "replace_summaries"; days: Array<{ dayNumber: number; summary: string }> };

export type TripRefinementPatch = {
  affectedSections: RefinableSection[];
  assistantMessage: string;
  preferences?: Partial<MasterTripPreferences>;
  itineraryOps?: ItineraryPatchOp[];
  practical?: Partial<MasterPracticalSnapshot>;
  whyItFits?: string[];
  recommendationNote?: string;
};

export type RefinementChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  quickActionId?: string;
  affectedSections?: RefinableSection[];
};

export type RefinementEngineInput = {
  message: string;
  quickActionId?: string;
  file: MasterTripFile;
};

export type RefinementEngineResult = {
  patch: TripRefinementPatch;
  source: "ai" | "rules";
};

export type ApplyPatchResult = {
  file: MasterTripFile;
  patch: TripRefinementPatch;
  changedSections: RefinableSection[];
};

export type QuickActionDef = {
  id: string;
  label: string;
  prompt: string;
  priorityHints?: TripPriority[];
};
