import type { DestinationMetadata } from "../models/destination";

function dayLines(
  count: number,
  templates: Array<(n: number) => string>,
): string[] {
  const d = Math.min(Math.max(1, count), 7);
  return Array.from({ length: d }, (_, i) => {
    const n = i + 1;
    const template = templates[Math.min(i, templates.length - 1)];
    return `Day ${n}: ${template(n)}`;
  });
}

export function buildSummaryItinerary(dest: DestinationMetadata, days: number): string[] {
  const name = dest.name;
  const styles = new Set(dest.tripStyles);

  if (styles.has("beach") || styles.has("island")) {
    return dayLines(days, [
      () => `Arrive in ${name}, settle in & sunset walk`,
      () => "Beach time or light water activity",
      () => "Local food & relaxed exploration",
      () => "Coastal viewpoints or boat trip",
      () => "Free day — spa, swim, or slow wander",
      () => "Village markets & sunset spots",
      () => "Easy morning before departure",
    ]);
  }

  if (styles.has("adventure")) {
    return dayLines(days, [
      () => `Arrive & acclimatize in ${name}`,
      () => "Signature adventure experience",
      () => "Scenic viewpoints & culture",
      () => "Buffer / weather contingency day",
      () => "Secondary trek or activity block",
      () => "Local guides & hidden trails",
      () => "Pack-down & transfer day",
    ]);
  }

  if (styles.has("hill-station")) {
    return dayLines(days, [
      () => "Drive in, slow evening & local dinner",
      () => "Viewpoints & nature walks",
      () => "Cafés, estates, or nearby sights",
      () => "Waterfall or valley day trip",
      () => "Leisure morning & photo spots",
      () => "Heritage walk & local crafts",
      () => "Checkout & scenic drive out",
    ]);
  }

  return dayLines(days, [
    () => `Arrive in ${name}, neighborhood orientation`,
    () => "Top highlight experience",
    () => "Food & culture focus",
    () => "Flexible sightseeing",
    () => "Day trip or secondary district",
    () => "Slow day — favorites & cafés",
    () => "Last sights before departure",
  ]);
}
