/**
 * Normalized trip plan — bridge between AI recommendation output and
 * the existing itinerary_days / itinerary_items workspace.
 */
export type NormalizedTripCoordinates = {
  lat: number;
  lng: number;
};

export type NormalizedTripActivity = {
  id: string;
  title: string;
  description: string;
  placeId?: string | null;
  startTime: string;
  endTime?: string | null;
  category?: string;
  notes?: string;
  coordinates?: NormalizedTripCoordinates | null;
  location?: string;
};

export type NormalizedTripDay = {
  dayNumber: number;
  title: string;
  summary: string;
  activities: NormalizedTripActivity[];
};

export type NormalizedTripPlan = {
  tripId?: string | null;
  masterTripFileId?: string | null;
  destination: {
    name: string;
    canonicalLocation: string;
    slug?: string | null;
    country?: string;
  };
  summary: string;
  whyThisFits: string[];
  budget: string;
  travelEffort: string;
  weather?: string;
  recommendationExplanation: string;
  days: NormalizedTripDay[];
};
