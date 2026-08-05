/**
 * Badge copy. Returns null when there is nothing trustworthy to show (0 / invalid).
 * 1 traveler → singular; otherwise plural.
 *
 * Early product: pass total event count (`totalInterest`), not unique travelers.
 */
export function formatDestinationInterestLabel(
  count: number,
  _month?: number,
): string | null {
  if (!Number.isFinite(count) || count < 1) return null;
  const value = Math.floor(count);
  const noun = value === 1 ? "traveler" : "travelers";
  return `🌍 ${value.toLocaleString("en-US")} ${noun} explored this destination this month`;
}

/** Display metric for badges. Swap to uniqueTravelers when that ships. */
export function displayInterestCount(snapshot: {
  totalInterest?: number;
  uniqueTravelers?: number;
} | null | undefined): number {
  if (!snapshot) return 0;
  if (typeof snapshot.totalInterest === "number" && Number.isFinite(snapshot.totalInterest)) {
    return snapshot.totalInterest;
  }
  return typeof snapshot.uniqueTravelers === "number" ? snapshot.uniqueTravelers : 0;
}

export function emptyInterestSnapshot(
  destinationId: string,
  year: number,
  month: number,
): {
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
} {
  return {
    destinationId,
    uniqueTravelers: 0,
    totalInterest: 0,
    searchCount: 0,
    recommendationCount: 0,
    detailViewCount: 0,
    tripAddCount: 0,
    favoriteCount: 0,
    month,
    year,
  };
}
