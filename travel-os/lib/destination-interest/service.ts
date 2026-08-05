import { createLogger } from "@/lib/observability/logger";
import {
  DUPLICATE_TRACK_WINDOW_MS,
  type DestinationInterestEventType,
} from "@/lib/destination-interest/constants";
import { emptyInterestSnapshot } from "@/lib/destination-interest/format";
import {
  interestCacheKey,
  invalidateInterestCache,
  readInterestCache,
  writeInterestCache,
} from "@/lib/destination-interest/cache";
import {
  isAcceptableDestinationId,
  resolveDestinationIdForTrack,
  resolveTopLevelDestination,
  type DestinationCandidate,
} from "@/lib/destination-interest/resolve";
import { getCurrentInterestPeriod } from "@/lib/destination-interest/time";
import type {
  DestinationInterestSnapshot,
  DestinationInterestStore,
  DestinationInterestTrackResult,
} from "@/lib/destination-interest/types";

const log = createLogger("destination-interest");

const recentTracks = new Map<string, number>();

function pruneRecent(now: number) {
  if (recentTracks.size < 500) return;
  for (const [key, ts] of recentTracks) {
    if (now - ts > DUPLICATE_TRACK_WINDOW_MS) recentTracks.delete(key);
  }
}

export function isDuplicateTrack(
  actorId: string,
  destinationId: string,
  eventType: DestinationInterestEventType,
  now = Date.now(),
): boolean {
  pruneRecent(now);
  const key = `${actorId}:${destinationId}:${eventType}`;
  const last = recentTracks.get(key) ?? 0;
  if (now - last < DUPLICATE_TRACK_WINDOW_MS) return true;
  recentTracks.set(key, now);
  return false;
}

function toSnapshot(
  destinationId: string,
  row: {
    unique_travelers: number;
    total_interest: number;
    search_count: number;
    ai_recommendation_count: number;
    detail_view_count: number;
    trip_add_count: number;
    favorite_count: number;
    month: number;
    year: number;
  } | null,
  year: number,
  month: number,
): DestinationInterestSnapshot {
  if (!row) return emptyInterestSnapshot(destinationId, year, month);
  return {
    destinationId,
    uniqueTravelers: row.unique_travelers,
    totalInterest: row.total_interest,
    searchCount: row.search_count,
    recommendationCount: row.ai_recommendation_count,
    detailViewCount: row.detail_view_count,
    tripAddCount: row.trip_add_count,
    favoriteCount: row.favorite_count,
    month: row.month,
    year: row.year,
  };
}

export class DestinationInterestService {
  constructor(private readonly store: DestinationInterestStore) {}

  async track(
    destinationId: string,
    eventType: DestinationInterestEventType,
    actorId: string,
  ): Promise<DestinationInterestTrackResult> {
    try {
      const actor = actorId.trim();
      if (!actor) return { success: true, skipped: "unauthenticated" };

      const resolvedId =
        resolveDestinationIdForTrack(destinationId) ??
        (isAcceptableDestinationId(destinationId) ? destinationId.trim().toLowerCase() : null);
      if (!resolvedId) return { success: true, skipped: "not_destination" };

      if (isDuplicateTrack(actor, resolvedId, eventType)) {
        return { success: true, skipped: "duplicate" };
      }

      await this.store.track({ destinationId: resolvedId, eventType, actorId: actor });
      const period = getCurrentInterestPeriod();
      invalidateInterestCache(resolvedId, period.year, period.month);
      return { success: true };
    } catch (error) {
      log.warn("destination_interest_track_failed", {
        destinationId,
        eventType,
        error: error instanceof Error ? error.message : "unknown",
      });
      return { success: true, skipped: "error" };
    }
  }

  async trackSearch(destinationId: string, actorId: string) {
    return this.track(destinationId, "SEARCH", actorId);
  }

  async trackRecommendation(destinationId: string, actorId: string) {
    return this.track(destinationId, "AI_RECOMMENDED", actorId);
  }

  async trackView(destinationId: string, actorId: string) {
    return this.track(destinationId, "DETAIL_VIEW", actorId);
  }

  async trackTripAdd(destinationId: string, actorId: string) {
    return this.track(destinationId, "TRIP_ADD", actorId);
  }

  async trackFavorite(destinationId: string, actorId: string) {
    return this.track(destinationId, "FAVORITE", actorId);
  }

  async trackCandidates(
    candidates: DestinationCandidate[],
    eventType: DestinationInterestEventType,
    actorId: string,
  ): Promise<void> {
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const resolved = resolveTopLevelDestination(candidate);
      if (!resolved || seen.has(resolved.id)) continue;
      seen.add(resolved.id);
      await this.track(resolved.id, eventType, actorId);
    }
  }

  async getInterest(destinationId: string): Promise<DestinationInterestSnapshot | null> {
    try {
      const id =
        resolveDestinationIdForTrack(destinationId) ??
        (isAcceptableDestinationId(destinationId) ? destinationId.trim().toLowerCase() : null);
      if (!id) return null;
      const period = getCurrentInterestPeriod();
      const cacheKey = interestCacheKey(id, period.year, period.month);
      const cached = readInterestCache(cacheKey);
      if (cached) return cached;
      const row = await this.store.getMonthly(id, period);
      const snapshot = toSnapshot(id, row, period.year, period.month);
      writeInterestCache(cacheKey, snapshot);
      return snapshot;
    } catch (error) {
      log.warn("destination_interest_read_failed", {
        destinationId,
        error: error instanceof Error ? error.message : "unknown",
      });
      return null;
    }
  }

  async getInterestBatch(destinationIds: string[]): Promise<DestinationInterestSnapshot[]> {
    const period = getCurrentInterestPeriod();
    const uniqueIds: string[] = [];
    const seen = new Set<string>();
    for (const raw of destinationIds) {
      const id =
        resolveDestinationIdForTrack(raw) ??
        (isAcceptableDestinationId(raw) ? raw.trim().toLowerCase() : null);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      uniqueIds.push(id);
    }
    if (!uniqueIds.length) return [];

    const hits: DestinationInterestSnapshot[] = [];
    const missing: string[] = [];
    for (const id of uniqueIds) {
      const cached = readInterestCache(interestCacheKey(id, period.year, period.month));
      if (cached) hits.push(cached);
      else missing.push(id);
    }

    if (!missing.length) return hits;

    try {
      const rows = await this.store.getMonthlyBatch(missing, period);
      const byId = new Map(rows.map((r) => [r.destination_id, r]));
      for (const id of missing) {
        const snapshot = toSnapshot(id, byId.get(id) ?? null, period.year, period.month);
        writeInterestCache(interestCacheKey(id, period.year, period.month), snapshot);
        hits.push(snapshot);
      }
      return hits;
    } catch (error) {
      log.warn("destination_interest_batch_read_failed", {
        count: missing.length,
        error: error instanceof Error ? error.message : "unknown",
      });
      return [
        ...hits,
        ...missing.map((id) => emptyInterestSnapshot(id, period.year, period.month)),
      ];
    }
  }
}

export function trackInterestFireAndForget(
  service: DestinationInterestService,
  destinationIds: string[],
  eventType: DestinationInterestEventType,
  actorId: string,
) {
  if (!actorId || !destinationIds.length) return;
  void Promise.allSettled(destinationIds.map((id) => service.track(id, eventType, actorId))).then(
    (results) => {
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        log.warn("destination_interest_background_track_failed", { failed, eventType });
      }
    },
  );
}
