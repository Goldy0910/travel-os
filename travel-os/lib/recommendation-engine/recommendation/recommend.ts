import type { DestinationMetadata } from "../models/destination";
import type { AlternativePick, RecommendationResult, TripPreferences } from "../types";
import { budgetLabel } from "../utils/budget";
import { formatRanking, topDestinationsForPrefs } from "../scoring/rank-destinations";
import { buildSummaryItinerary } from "./build-itinerary";

function effortLabel(dest: DestinationMetadata): string {
  const base =
    dest.travelEffort === "low"
      ? "Light travel"
      : dest.travelEffort === "medium"
        ? "Moderate effort"
        : "High effort";
  return dest.domesticIndia ? `${base} · Domestic` : `${base} · International`;
}

function toAlternative(scored: { destination: DestinationMetadata; score: number }, reason: string): AlternativePick {
  return {
    name: scored.destination.name,
    slug: scored.destination.slug,
    reason,
    fitScore: scored.score,
  };
}

export function recommendDestinations(prefs: TripPreferences): RecommendationResult {
  const ranked = topDestinationsForPrefs(prefs, 8);
  const top = ranked[0];
  if (!top) {
    throw new Error("No destinations in catalog");
  }

  const tier = prefs.budget ?? top.destination.budgetLevel;
  const alts = ranked.slice(1, 4).map((r, i) =>
    toAlternative(r, altReason(i + 2, prefs.days, r.score)),
  );

  return {
    mode: "recommendation",
    destination: top.destination.name,
    destinationSlug: top.destination.slug,
    canonicalLocation: top.destination.canonicalLocation,
    country: top.destination.country,
    state: top.destination.state,
    fitScore: top.score,
    scoreBreakdown: top.breakdown,
    explanation: top.explanations[0] ?? `Top match for your ${prefs.days}-day trip.`,
    whyItFits: top.explanations,
    travelEffort: effortLabel(top.destination),
    budgetEstimate: budgetLabel(tier, prefs.days),
    itinerary: buildSummaryItinerary(top.destination, prefs.days),
    alternatives: alts,
    ranking: formatRanking(ranked.slice(0, 5)),
  };
}

function altReason(rank: number, days: number, score: number): string {
  return `#${rank} pick · ${score}/100 fit · works well for ${days} days`;
}
