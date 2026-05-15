import "server-only";

import { getCachedSearchPlaceId } from "@/lib/activity-place-details-cache";
import type { NormalizedTripActivity } from "../types";
import type { PlaceMatchInput, PlaceMatchResult } from "./types";

const DEFAULT_CONCURRENCY = 3;

function buildPlaceQuery(input: PlaceMatchInput): string {
  const dest = input.destination.trim();
  const title = input.title.trim();
  const location = input.location.trim();

  if (location && location !== dest) {
    return [title, location, dest].filter(Boolean).join(", ");
  }
  return [title, dest].filter(Boolean).join(", ");
}

/**
 * Resolves a Google Place ID for a single activity (cached server-side).
 */
export async function matchPlaceForActivity(
  input: PlaceMatchInput,
): Promise<PlaceMatchResult> {
  const query = buildPlaceQuery(input);
  if (!query.trim()) {
    return { activityKey: input.activityKey, placeId: null, query, matched: false };
  }

  try {
    const placeId = await getCachedSearchPlaceId(query);
    return {
      activityKey: input.activityKey,
      placeId: placeId || null,
      query,
      matched: Boolean(placeId),
    };
  } catch {
    return { activityKey: input.activityKey, placeId: null, query, matched: false };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Attempts place matching for normalized activities; mutates placeId on matches.
 */
export async function enrichActivitiesWithPlaces(
  activities: NormalizedTripActivity[],
  destination: string,
  options?: { concurrency?: number; maxMatches?: number },
): Promise<{ enriched: NormalizedTripActivity[]; matchCount: number }> {
  const dest = destination.trim() || "Destination";
  const max = options?.maxMatches ?? activities.length;
  const toMatch = activities.slice(0, max);

  const inputs: PlaceMatchInput[] = toMatch.map((a) => ({
    activityKey: a.id,
    title: a.title,
    location: a.location ?? dest,
    destination: dest,
  }));

  const matches = await mapWithConcurrency(
    inputs,
    options?.concurrency ?? DEFAULT_CONCURRENCY,
    matchPlaceForActivity,
  );

  const placeByKey = new Map(matches.map((m) => [m.activityKey, m.placeId]));
  let matchCount = 0;

  const enriched = activities.map((activity) => {
    const placeId = placeByKey.get(activity.id);
    if (!placeId) return activity;
    matchCount += 1;
    return { ...activity, placeId };
  });

  return { enriched, matchCount };
}
