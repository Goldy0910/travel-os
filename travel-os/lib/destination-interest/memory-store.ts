import { applyInterestEvent, emptyInterestCounters } from "@/lib/destination-interest/apply";
import type { DestinationInterestEventType } from "@/lib/destination-interest/constants";
import type { DestinationInterestPeriod } from "@/lib/destination-interest/types";
import type {
  DestinationInterestMonthlyRow,
  DestinationInterestStore,
  TrackDestinationInterestInput,
} from "@/lib/destination-interest/types";

type EventRow = {
  userId: string;
  destinationId: string;
  eventType: DestinationInterestEventType;
  year: number;
  month: number;
};

function periodKey(destinationId: string, period: DestinationInterestPeriod): string {
  return `${destinationId}:${period.year}:${period.month}`;
}

function actorKey(userId: string, destinationId: string, period: DestinationInterestPeriod): string {
  return `${userId}:${destinationId}:${period.year}:${period.month}`;
}

/**
 * Deterministic in-memory store for unit/integration tests.
 * Simulates the unique-traveler + counter upsert semantics.
 */
export class InMemoryDestinationInterestStore implements DestinationInterestStore {
  readonly events: EventRow[] = [];
  private readonly monthly = new Map<string, DestinationInterestMonthlyRow>();

  constructor(private readonly period: DestinationInterestPeriod) {}

  async track(input: TrackDestinationInterestInput): Promise<{ newUniqueTraveler: boolean }> {
    const { destinationId, eventType, actorId } = input;
    const seen = this.events.some(
      (e) =>
        e.userId === actorId &&
        e.destinationId === destinationId &&
        e.year === this.period.year &&
        e.month === this.period.month,
    );
    const isNew = !seen;
    this.events.push({
      userId: actorId,
      destinationId,
      eventType,
      year: this.period.year,
      month: this.period.month,
    });

    const key = periodKey(destinationId, this.period);
    const current = this.monthly.get(key);
    const counters = applyInterestEvent(
      current
        ? {
            uniqueTravelers: current.unique_travelers,
            searchCount: current.search_count,
            recommendationCount: current.ai_recommendation_count,
            detailViewCount: current.detail_view_count,
            tripAddCount: current.trip_add_count,
            favoriteCount: current.favorite_count,
            totalInterest: current.total_interest,
          }
        : emptyInterestCounters(),
      eventType,
      isNew,
    );
    this.monthly.set(key, {
      destination_id: destinationId,
      year: this.period.year,
      month: this.period.month,
      unique_travelers: counters.uniqueTravelers,
      search_count: counters.searchCount,
      ai_recommendation_count: counters.recommendationCount,
      detail_view_count: counters.detailViewCount,
      trip_add_count: counters.tripAddCount,
      favorite_count: counters.favoriteCount,
      total_interest: counters.totalInterest,
    });
    return { newUniqueTraveler: isNew };
  }

  async getMonthly(
    destinationId: string,
    period: DestinationInterestPeriod,
  ): Promise<DestinationInterestMonthlyRow | null> {
    return this.monthly.get(periodKey(destinationId, period)) ?? null;
  }

  async getMonthlyBatch(
    destinationIds: string[],
    period: DestinationInterestPeriod,
  ): Promise<DestinationInterestMonthlyRow[]> {
    return destinationIds
      .map((id) => this.monthly.get(periodKey(id, period)))
      .filter((row): row is DestinationInterestMonthlyRow => row != null);
  }

  hasActorEvent(actorId: string, destinationId: string): boolean {
    return this.events.some(
      (e) => actorKey(e.userId, e.destinationId, this.period) === actorKey(actorId, destinationId, this.period),
    );
  }
}
