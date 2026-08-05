import type { DestinationInterestEventType } from "@/lib/destination-interest/constants";

export type DestinationInterestPeriod = {
  year: number;
  month: number;
};

export type DestinationInterestSnapshot = {
  destinationId: string;
  uniqueTravelers: number;
  totalInterest: number;
  searchCount: number;
  recommendationCount: number;
  detailViewCount: number;
  tripAddCount: number;
  favoriteCount: number;
  month: number;
  year: number;
};

export type DestinationInterestTrackResult = {
  success: true;
  skipped?: "duplicate" | "not_destination" | "invalid" | "unauthenticated" | "error";
};

export type DestinationInterestMonthlyRow = {
  destination_id: string;
  year: number;
  month: number;
  unique_travelers: number;
  search_count: number;
  ai_recommendation_count: number;
  detail_view_count: number;
  trip_add_count: number;
  favorite_count: number;
  total_interest: number;
};

export type TrackDestinationInterestInput = {
  destinationId: string;
  eventType: DestinationInterestEventType;
  actorId: string;
};

export type DestinationInterestStore = {
  track(input: TrackDestinationInterestInput): Promise<{ newUniqueTraveler: boolean } | null>;
  getMonthly(
    destinationId: string,
    period: DestinationInterestPeriod,
  ): Promise<DestinationInterestMonthlyRow | null>;
  getMonthlyBatch(
    destinationIds: string[],
    period: DestinationInterestPeriod,
  ): Promise<DestinationInterestMonthlyRow[]>;
};

export type ResolvedDestination = {
  id: string;
  name: string;
  source: "catalog" | "travel_place" | "generated";
};
