import type { DestinationInterestEventType } from "@/lib/destination-interest/constants";

export type InterestCounters = {
  uniqueTravelers: number;
  searchCount: number;
  recommendationCount: number;
  detailViewCount: number;
  tripAddCount: number;
  favoriteCount: number;
  totalInterest: number;
};

export function emptyInterestCounters(): InterestCounters {
  return {
    uniqueTravelers: 0,
    searchCount: 0,
    recommendationCount: 0,
    detailViewCount: 0,
    tripAddCount: 0,
    favoriteCount: 0,
    totalInterest: 0,
  };
}

/**
 * Pure reducer used by tests and the in-memory store.
 * Unique travelers increment only when this is the actor's first event
 * for the destination in the current month.
 */
export function applyInterestEvent(
  state: InterestCounters,
  eventType: DestinationInterestEventType,
  isNewUniqueTraveler: boolean,
): InterestCounters {
  const next: InterestCounters = {
    ...state,
    totalInterest: state.totalInterest + 1,
    uniqueTravelers: state.uniqueTravelers + (isNewUniqueTraveler ? 1 : 0),
  };
  switch (eventType) {
    case "SEARCH":
      next.searchCount += 1;
      break;
    case "AI_RECOMMENDED":
      next.recommendationCount += 1;
      break;
    case "DETAIL_VIEW":
      next.detailViewCount += 1;
      break;
    case "TRIP_ADD":
      next.tripAddCount += 1;
      break;
    case "FAVORITE":
      next.favoriteCount += 1;
      break;
    default: {
      const _exhaustive: never = eventType;
      return _exhaustive;
    }
  }
  return next;
}
