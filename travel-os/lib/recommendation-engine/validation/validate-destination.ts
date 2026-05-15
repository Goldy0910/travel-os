import { resolveDestination } from "@/app/app/_lib/destination-intel";
import type { DestinationMetadata } from "../models/destination";
import type { FitLevel, TripPreferences, ValidationResult } from "../types";
import { rankDestinations } from "../scoring/rank-destinations";
import { scoreDestination } from "../scoring/score-destination";
import { budgetLabel } from "../utils/budget";
import { findDestinationByInput } from "../utils/resolve";

function fitFromScore(
  score: number,
  hasCatalog: boolean,
  days: number,
  minDays: number,
): FitLevel {
  if (hasCatalog && days < minDays) {
    return "weak";
  }
  if (!hasCatalog) return score >= 60 ? "moderate" : "weak";
  if (score >= 78) return "strong";
  if (score >= 55) return "moderate";
  return "weak";
}

function effortLabel(dest: DestinationMetadata): string {
  const base =
    dest.travelEffort === "low"
      ? "Light travel"
      : dest.travelEffort === "medium"
        ? "Moderate effort"
        : "High effort";
  return dest.domesticIndia ? `${base} · Domestic` : `${base} · International`;
}

export function validateDestinationInput(prefs: TripPreferences): ValidationResult {
  const raw = prefs.destination?.trim() ?? "";
  const catalog = findDestinationByInput(raw);
  const intel = resolveDestination(raw);
  const name = catalog?.name ?? intel.city;
  const slug = catalog?.slug ?? null;

  const days = prefs.days;
  const { min, ideal, max } = catalog?.idealDuration ?? { min: 3, ideal: 5, max: 7 };

  const scored = catalog ? scoreDestination(catalog, prefs) : null;

  const fitScore = scored?.score ?? 55;
  const fit = fitFromScore(fitScore, Boolean(catalog), days, min);
  const breakdown = scored?.breakdown ?? {
    timeFit: 50,
    budgetFit: 50,
    preferenceAlignment: 50,
    travelPracticality: 50,
    seasonalFit: 50,
    effortPenalty: 50,
    total: fitScore,
  };

  let summary = `We evaluated ${name} for your ${days}-day trip.`;
  if (fit === "strong") summary = `${name} is a strong fit for ${days} days.`;
  if (fit === "moderate") summary = `${name} can work — a few trade-offs to consider.`;
  if (fit === "weak") summary = `${name} is a weak fit for ${days} days — see alternatives.`;

  const timeFit =
    days < min
      ? `Too short — ${name} shines with ${ideal}+ days (min ${min}).`
      : days > max
        ? `Long trip — consider adding stops beyond ${name}.`
        : `Good duration window (${min}–${max} days, ideal ${ideal}).`;

  const travelEffort = catalog
    ? effortLabel(catalog)
    : intel.country === "India"
      ? "Light travel · Domestic"
      : "Moderate effort · International";

  const practicality =
    catalog?.domesticIndia || intel.country === "India"
      ? "Domestic travel — simpler logistics from India."
      : "International — factor visa, forex, and flights.";

  const tier = prefs.budget ?? catalog?.budgetLevel ?? "moderate";
  const budgetRealism =
    fit === "weak" && tier === "budget" && catalog?.budgetLevel === "premium"
      ? "Premium destination on a budget — expect compromises."
      : budgetLabel(tier, days);

  const ranked = rankDestinations(prefs, {
    excludeSlugs: slug ? [slug] : [],
    limit: 5,
  });

  const alternatives = ranked.slice(0, fit === "weak" ? 3 : 2).map((r) => ({
    name: r.destination.name,
    slug: r.destination.slug,
    reason:
      fit === "weak"
        ? `Better ${days}-day fit (score ${r.score}/100).`
        : `Similar vibe · ${r.score}/100 fit.`,
    fitScore: r.score,
  }));

  return {
    mode: "validation",
    destination: name,
    destinationSlug: slug,
    fit,
    fitScore,
    scoreBreakdown: breakdown,
    explanation: scored?.explanations[0] ?? summary,
    summary,
    travelEffort,
    practicality,
    timeFit,
    budgetRealism,
    alternatives,
  };
}
