import type { DestinationMetadata, OriginReach } from "../models/destination";
import type { ScoreBreakdown, ScoredDestination, TripPreferences, TripPriority } from "../types";
import { budgetFitScore } from "../utils/budget";
import { seasonalFitScore } from "../utils/seasonal";
import { findOriginCitySlug } from "../utils/resolve";
import { SCORING_WEIGHTS } from "./weights";

const PRIORITY_SCORE_KEYS: Record<
  TripPriority,
  keyof DestinationMetadata["scores"] | "accessibility"
> = {
  relaxing: "relaxation",
  scenic: "scenic",
  adventure: "adventure",
  "food-culture": "foodCulture",
  "budget-friendly": "accessibility",
  "easy-to-reach": "accessibility",
};

function timeFitScore(dest: DestinationMetadata, days: number): number {
  const { min, ideal, max } = dest.idealDuration;
  if (days >= min && days <= max) {
    const idealDelta = Math.abs(days - ideal);
    return Math.max(85, 100 - idealDelta * 5);
  }
  if (days < min) return Math.max(20, 60 - (min - days) * 15);
  return Math.max(35, 70 - (days - max) * 8);
}

function reachToPracticality(reach?: OriginReach): number {
  if (reach === "easy") return 100;
  if (reach === "moderate") return 70;
  if (reach === "hard") return 40;
  return 55;
}

function travelPracticalityScore(
  dest: DestinationMetadata,
  originSlug: string,
): number {
  const explicit = dest.reachFromOrigins[originSlug];
  if (explicit) return reachToPracticality(explicit);
  if (dest.domesticIndia) return 65;
  return 50;
}

function effortPenaltyScore(effort: DestinationMetadata["travelEffort"]): number {
  if (effort === "low") return 100;
  if (effort === "medium") return 75;
  return 50;
}

function preferenceAlignmentScore(
  dest: DestinationMetadata,
  priorities: TripPriority[],
): number {
  if (!priorities.length) {
    const avg =
      (dest.scores.relaxation +
        dest.scores.scenic +
        dest.scores.adventure +
        dest.scores.foodCulture) /
      4;
    return Math.round(avg);
  }
  let sum = 0;
  let count = 0;
  for (const p of priorities) {
    const key = PRIORITY_SCORE_KEYS[p];
    if (p === "budget-friendly" && dest.budgetLevel === "budget") {
      sum += 95;
    } else if (p === "easy-to-reach") {
      sum += dest.scores.accessibility;
    } else {
      sum += dest.scores[key as keyof typeof dest.scores] ?? 50;
    }
    count += 1;
  }
  return Math.round(sum / count);
}

function weightedTotal(parts: Omit<ScoreBreakdown, "total">): number {
  const w = SCORING_WEIGHTS;
  const raw =
    (parts.timeFit * w.timeFit +
      parts.budgetFit * w.budgetFit +
      parts.preferenceAlignment * w.preferenceAlignment +
      parts.travelPracticality * w.travelPracticality +
      parts.seasonalFit * w.seasonalFit +
      parts.effortPenalty * w.effortPenalty) /
    100;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function scoreDestination(
  dest: DestinationMetadata,
  prefs: TripPreferences,
): ScoredDestination {
  const originSlug = findOriginCitySlug(prefs.originCity);
  const parts = {
    timeFit: timeFitScore(dest, prefs.days),
    budgetFit: budgetFitScore(prefs.budget, dest.budgetLevel),
    preferenceAlignment: preferenceAlignmentScore(dest, prefs.priorities),
    travelPracticality: travelPracticalityScore(dest, originSlug),
    seasonalFit: seasonalFitScore(dest, prefs.travelMonth),
    effortPenalty: effortPenaltyScore(dest.travelEffort),
  };
  const breakdown: ScoreBreakdown = {
    ...parts,
    total: weightedTotal(parts),
  };
  const explanations = buildExplanations(dest, prefs, breakdown, originSlug);
  return { destination: dest, score: breakdown.total, breakdown, explanations };
}

function buildExplanations(
  dest: DestinationMetadata,
  prefs: TripPreferences,
  breakdown: ScoreBreakdown,
  originSlug: string,
): string[] {
  const lines: string[] = [];
  const { min, ideal, max } = dest.idealDuration;

  if (prefs.days >= min && prefs.days <= max) {
    lines.push(`Strong time fit for ${prefs.days} days (ideal ~${ideal}).`);
  } else if (prefs.days < min) {
    lines.push(`Short for ${dest.name} — ${min}+ days recommended.`);
  } else {
    lines.push(`Room to explore over ${prefs.days} days without rushing.`);
  }

  if (breakdown.preferenceAlignment >= 80) {
    lines.push(`High alignment with your trip priorities.`);
  }

  const reach = dest.reachFromOrigins[originSlug];
  if (reach === "easy") {
    lines.push(`Easy to reach from ${prefs.originCity || originSlug}.`);
  } else if (reach === "hard") {
    lines.push(`Longer travel from your starting city — plan extra transit time.`);
  }

  if (prefs.budget && breakdown.budgetFit >= 80) {
    lines.push(`Matches your ${prefs.budget} budget tier.`);
  }

  return lines.slice(0, 4);
}
