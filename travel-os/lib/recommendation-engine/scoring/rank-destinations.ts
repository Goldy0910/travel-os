import type { DestinationMetadata } from "../models/destination";
import type { ScoredDestination, TripPreferences } from "../types";
import { listAllDestinations } from "../utils/resolve";
import { scoreDestination } from "./score-destination";

export function rankDestinations(
  prefs: TripPreferences,
  options?: { excludeSlugs?: string[]; limit?: number },
): ScoredDestination[] {
  const exclude = new Set(options?.excludeSlugs ?? []);
  const limit = options?.limit ?? listAllDestinations().length;

  return listAllDestinations()
    .filter((d) => !exclude.has(d.slug))
    .map((dest) => scoreDestination(dest, prefs))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function topDestinationsForPrefs(
  prefs: TripPreferences,
  count = 5,
): ScoredDestination[] {
  return rankDestinations(prefs, { limit: count });
}

export function formatRanking(scored: ScoredDestination[]): Array<{
  slug: string;
  name: string;
  fitScore: number;
}> {
  return scored.map((s) => ({
    slug: s.destination.slug,
    name: s.destination.name,
    fitScore: s.score,
  }));
}
