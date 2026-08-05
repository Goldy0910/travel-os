import type { DestinationInterestPeriod } from "@/lib/destination-interest/types";

/** UTC calendar month — analytics reset automatically on month boundaries. */
export function getCurrentInterestPeriod(now: Date = new Date()): DestinationInterestPeriod {
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

export function isSameInterestPeriod(
  a: DestinationInterestPeriod,
  b: DestinationInterestPeriod,
): boolean {
  return a.year === b.year && a.month === b.month;
}
