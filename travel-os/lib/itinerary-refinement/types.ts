import type { ItineraryOptimizationActivity } from "@/lib/ai/itinerary-optimization-engine";

export type ItineraryItemPatchOp =
  | {
      op: "update";
      id: string;
      title?: string;
      activity_name?: string;
      time?: string | null;
      location?: string;
      notes?: string | null;
    }
  | {
      op: "add";
      date: string;
      title: string;
      activity_name?: string;
      time?: string | null;
      location: string;
      insertAfterId?: string | null;
    }
  | { op: "remove"; id: string };

export type ItineraryRefinementPatch = {
  assistantMessage: string;
  quickActionId?: string;
  affectedDates: string[];
  ops: ItineraryItemPatchOp[];
  /** Items skipped because user_modified=true */
  preservedUserEdits: number;
};

export type ItineraryRefinementChange = {
  id: string;
  type: "update" | "add" | "remove" | "skipped";
  date: string;
  title: string;
  detail: string;
  before?: string;
  after?: string;
};

export type TripItinerarySnapshot = {
  scope: "itinerary_refine";
  affectedDates: string[];
  activities: ItineraryOptimizationActivity[];
};

export type RefinementEngineInput = {
  tripId: string;
  destination: string;
  message: string;
  quickActionId?: string;
  activities: ItineraryOptimizationActivity[];
};

export type RefinementEngineResult = {
  patch: ItineraryRefinementPatch;
  source: "ai" | "rules";
};

export type ApplyItineraryPatchResult = {
  patch: ItineraryRefinementPatch;
  revisionId: string | null;
  appliedOps: number;
  skippedOps: number;
};
