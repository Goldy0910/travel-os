import type { DestinationMetadata } from "../models/destination";

export function buildSummaryItinerary(dest: DestinationMetadata, days: number): string[] {
  const d = Math.min(days, 7);
  const name = dest.name;
  const styles = new Set(dest.tripStyles);

  if (styles.has("beach") || styles.has("island")) {
    return [
      `Day 1: Arrive in ${name}, settle in & sunset walk`,
      `Day 2: Beach time or light water activity`,
      ...(d >= 3 ? [`Day 3: Local food & relaxed exploration`] : []),
      ...(d >= 4 ? [`Day 4: Free morning before departure`] : []),
    ];
  }

  if (styles.has("adventure")) {
    return [
      `Day 1: Arrive & acclimatize in ${name}`,
      `Day 2: Signature adventure experience`,
      ...(d >= 3 ? [`Day 3: Scenic viewpoints & culture`] : []),
      ...(d >= 4 ? [`Day 4: Buffer / weather contingency day`] : []),
    ];
  }

  if (styles.has("hill-station")) {
    return [
      `Day 1: Drive in, slow evening & local dinner`,
      `Day 2: Viewpoints & nature walks`,
      ...(d >= 3 ? [`Day 3: Cafés, estates, or nearby sights`] : []),
    ];
  }

  return [
    `Day 1: Arrive in ${name}, neighborhood orientation`,
    `Day 2: Top highlight experience`,
    ...(d >= 3 ? [`Day 3: Food & culture focus`] : []),
    ...(d >= 4 ? [`Day 4: Flexible sightseeing`] : []),
  ];
}
