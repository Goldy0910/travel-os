import { DESTINATION_CATALOG } from "@/lib/find-destination/catalog";
import type { DestinationRecommendation } from "@/app/find-destination/_lib/types";
import {
  buildChooseIf,
  buildExpertOpinion,
  buildPersonalizedReasons,
  buildRankedLowerReasons,
  buildWhyNotUserChoice,
  comparisonDims,
} from "./explanations";
import { breakScoreTies, scoreDestinationExpert } from "./score";
import type {
  ExpertPreferenceSignals,
  ExpertRankedDestination,
  ExpertRecommendationResult,
} from "./types";

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchCatalogByName(name: string): DestinationRecommendation | null {
  const needle = normalizeName(name);
  if (!needle) return null;

  const exact = DESTINATION_CATALOG.find(
    (d) =>
      normalizeName(d.name) === needle ||
      normalizeName(`${d.name} ${d.country}`) === needle ||
      normalizeName(d.slug.replace(/-/g, " ")) === needle,
  );
  if (exact) return exact;

  return (
    DESTINATION_CATALOG.find(
      (d) =>
        needle.includes(normalizeName(d.name)) ||
        normalizeName(d.name).includes(needle) ||
        d.slug.includes(needle.replace(/\s+/g, "-")),
    ) ?? null
  );
}

function toRanked(
  dest: DestinationRecommendation,
  matchScore: number,
  signals: ExpertPreferenceSignals,
  role: "primary" | "alternative",
  primaryDest?: DestinationRecommendation,
): ExpertRankedDestination {
  return {
    slug: dest.slug,
    name: dest.name,
    country: dest.country,
    matchScore,
    summary: dest.shortDescription,
    whyReasons: buildPersonalizedReasons(dest, signals),
    rankedLowerReasons:
      role === "alternative" && primaryDest
        ? buildRankedLowerReasons(primaryDest, dest, signals)
        : [],
    chooseIf: buildChooseIf(dest, signals, role),
    comparison: comparisonDims(dest),
    role,
  };
}

/**
 * Rank destinations and produce a single primary + up to two alternatives.
 * Prefer candidate names when provided; otherwise score the full catalog.
 */
export function buildExpertRecommendation(input: {
  signals: ExpertPreferenceSignals;
  candidateNames?: string[];
  /** Max total destinations (primary + alternatives). Hard cap 3. */
  limit?: number;
}): ExpertRecommendationResult | null {
  const limit = Math.min(3, Math.max(1, input.limit ?? 3));
  const fromNames: DestinationRecommendation[] = [];

  for (const name of input.candidateNames ?? []) {
    const match = matchCatalogByName(name);
    if (!match) continue;
    if (fromNames.some((d) => d.slug === match.slug)) continue;
    fromNames.push(match);
  }

  const pool =
    fromNames.length > 0
      ? fromNames
      : [...DESTINATION_CATALOG];

  if (pool.length === 0) return null;

  const scored = pool
    .map((dest) => {
      const { matchScore } = scoreDestinationExpert(dest, input.signals);
      return { dest, matchScore, slug: dest.slug };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  const tieBroken = breakScoreTies(scored);
  const bySlug = new Map(scored.map((s) => [s.slug, s.dest]));
  const rankedRows = tieBroken
    .map((t) => {
      const dest = bySlug.get(t.slug);
      if (!dest) return null;
      return { dest, matchScore: t.matchScore };
    })
    .filter((r): r is { dest: DestinationRecommendation; matchScore: number } => r != null)
    .sort((a, b) => b.matchScore - a.matchScore);

  const top = rankedRows.slice(0, limit);
  if (!top.length) return null;

  const primaryDest = top[0]!.dest;
  const primary = toRanked(primaryDest, top[0]!.matchScore, input.signals, "primary");
  const alternatives = top.slice(1).map((row) =>
    toRanked(row.dest, row.matchScore, input.signals, "alternative", primaryDest),
  );

  const result: ExpertRecommendationResult = {
    primary,
    alternatives,
    expertOpinion: buildExpertOpinion(primary, input.signals),
    comparisonRows: [primary, ...alternatives].map((d) => ({
      destination: d.name,
      budget: d.comparison.budget,
      weather: d.comparison.weather,
      activities: d.comparison.activities,
      food: d.comparison.food,
      safety: d.comparison.safety,
      overallMatch: d.matchScore,
    })),
  };

  const mentioned = input.signals.mentionedDestination?.trim();
  if (mentioned) {
    const mentionedNorm = normalizeName(mentioned);
    const isPrimary =
      normalizeName(primary.name) === mentionedNorm ||
      primary.slug.includes(mentionedNorm.replace(/\s+/g, "-"));
    if (!isPrimary) {
      result.whyNotUserChoice = buildWhyNotUserChoice(mentioned, primary, input.signals);
    }
  }

  return result;
}

/**
 * Insufficient signal when core prefs are missing — caller should ask ONE follow-up.
 */
export function hasEnoughSignalsForRecommendation(signals: ExpertPreferenceSignals): boolean {
  const hasBudget = Boolean(signals.budgetInr || signals.budgetLabel);
  const hasDuration = Boolean(signals.durationDays || signals.durationLabel);
  const hasInterests = signals.interests.length > 0;
  const coreCount = [hasBudget, hasDuration, hasInterests].filter(Boolean).length;
  return coreCount >= 2;
}
