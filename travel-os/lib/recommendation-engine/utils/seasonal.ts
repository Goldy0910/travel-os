import type { DestinationMetadata } from "../models/destination";

export function seasonalFitScore(
  dest: DestinationMetadata,
  travelMonth?: number,
): number {
  if (!travelMonth || travelMonth < 1 || travelMonth > 12) return 70;
  if (dest.bestMonths.includes(travelMonth)) return 100;
  const adjacent = [
    travelMonth === 1 ? 12 : travelMonth - 1,
    travelMonth === 12 ? 1 : travelMonth + 1,
  ];
  if (adjacent.some((m) => dest.bestMonths.includes(m))) return 75;
  return 45;
}

export function monthName(month: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(2024, month - 1, 1),
  );
}
