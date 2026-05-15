import type { NormalizedTripActivity, NormalizedTripDay, NormalizedTripPlan } from "../types";

/** Raw parsed segment before normalization. */
export type ParsedItinerarySegment = {
  dayNumber: number;
  dayTitle: string;
  summary: string;
  segments: ParsedActivitySegment[];
};

export type ParsedActivitySegment = {
  title: string;
  description: string;
  locationHint?: string;
  timeHint?: string;
  categoryHint?: string;
};

export type TimelineSlot = {
  dateYmd: string;
  dayNumber: number;
  itineraryDayId: string | number;
  activities: NormalizedTripActivity[];
};

export type ItineraryItemInsertRow = {
  trip_id: string;
  user_id: string;
  itinerary_day_id: string | number;
  date: string;
  activity_name: string;
  title: string;
  location: string;
  time: string | null;
  ai_generated: boolean;
  google_place_id?: string | null;
  notes?: string | null;
  category?: string | null;
};

export type HydrationContext = {
  tripId: string;
  userId: string;
  startDateYmd: string;
  endDateYmd: string;
  plan: NormalizedTripPlan;
};

export type HydrationPipelineResult = {
  rows: ItineraryItemInsertRow[];
  days: NormalizedTripDay[];
  warnings: string[];
};

export type PlaceMatchInput = {
  activityKey: string;
  title: string;
  location: string;
  destination: string;
};

export type PlaceMatchResult = {
  activityKey: string;
  placeId: string | null;
  query: string;
  matched: boolean;
};
