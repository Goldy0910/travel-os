import type { DestinationRecommendation } from "@/app/find-destination/_lib/types";
import { EXPERT_SCORING_WEIGHTS } from "./weights";
import type { ExpertPreferenceSignals, ExpertScoreBreakdown } from "./types";

const INTEREST_TAGS: Record<string, string[]> = {
  beaches: ["beach", "island", "coast", "reef", "surf"],
  mountains: ["mountain", "alpine", "himalaya", "valley", "altitude"],
  adventure: ["adventure", "rafting", "active", "trek", "road"],
  wildlife: ["wildlife", "marine", "reef", "snorkel"],
  food: ["food", "cafe", "cuisine", "hawker", "seafood"],
  nightlife: ["night", "nightlife", "energy", "club"],
  shopping: ["shopping", "bazaar", "market", "mall"],
  history: ["history", "heritage", "fort", "palace", "temple", "museum"],
  spiritual: ["spiritual", "yoga", "temple", "ashram", "monastery"],
  photography: ["photography", "photogenic", "cinematic", "iconic"],
  "road-trips": ["road", "drive", "scenic"],
  "hidden-gems": ["quiet", "hidden", "unhurried"],
  luxury: ["luxury", "polished", "overwater", "spa"],
  relaxation: ["relax", "unwind", "calm", "slow", "wellness"],
};

const WEATHER_SLUG_HINTS: Record<string, string[]> = {
  snow: ["manali", "leh"],
  cold: ["manali", "leh", "paris", "tokyo"],
  pleasant: ["jaipur", "udaipur", "paris", "tokyo", "rishikesh"],
  warm: ["goa", "dubai", "bangkok", "singapore", "bali", "kerala"],
  beach: ["goa", "andaman", "bali", "maldives", "bangkok"],
  mild: ["jaipur", "udaipur", "paris", "tokyo"],
  dry: ["jaipur", "dubai", "udaipur"],
};

function destBlob(dest: DestinationRecommendation): string {
  return `${dest.shortDescription} ${dest.overview} ${dest.travelStyle} ${dest.topAttractions.join(" ")} ${dest.weatherSummary} ${dest.foodHighlights.join(" ")} ${dest.safetyNotes}`.toLowerCase();
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function scoreInterests(dest: DestinationRecommendation, signals: ExpertPreferenceSignals): number {
  if (!signals.interests.length) return 0.55;
  const blob = destBlob(dest);
  let hits = 0;
  for (const interest of signals.interests) {
    const keys = INTEREST_TAGS[interest.toLowerCase()] ?? [interest.toLowerCase()];
    if (keys.some((k) => blob.includes(k) || dest.slug.includes(k))) hits += 1;
  }
  return clamp01(hits / Math.max(1, Math.min(signals.interests.length, 4)));
}

function scoreBudget(dest: DestinationRecommendation, signals: ExpertPreferenceSignals): number {
  const budget = signals.budgetInr;
  if (!budget || budget <= 0) return 0.55;
  const mid = (dest.estimatedBudgetInr.min + dest.estimatedBudgetInr.max) / 2;
  if (mid <= budget * 1.05) {
    // Comfortable fit — reward value when well under budget but not absurdly cheap mismatch
    const ratio = mid / budget;
    if (ratio >= 0.45) return clamp01(1 - Math.abs(ratio - 0.75) * 0.5);
    return 0.7;
  }
  const overshoot = (mid - budget) / budget;
  return clamp01(1 - overshoot * 1.4);
}

function scoreWeather(dest: DestinationRecommendation, signals: ExpertPreferenceSignals): number {
  if (!signals.weather) return 0.55;
  const w = signals.weather.toLowerCase();
  const blob = dest.weatherSummary.toLowerCase();
  const hints = WEATHER_SLUG_HINTS[w] ?? [];
  if (hints.some((h) => dest.slug.includes(h))) return 0.95;
  const token = w.split(/\s+/)[0] ?? w;
  if (blob.includes(token) || destBlob(dest).includes(token)) return 0.85;
  if (w.includes("warm") && /warm|humid|tropical|beach/.test(blob)) return 0.8;
  if (w.includes("cold") && /cold|snow|winter|alpine/.test(blob)) return 0.8;
  return 0.35;
}

function scoreDuration(dest: DestinationRecommendation, signals: ExpertPreferenceSignals): number {
  const days = signals.durationDays;
  if (!days) return 0.55;
  const ideal = dest.idealDuration.toLowerCase();
  if (days <= 3 && /[23]/.test(ideal)) return 0.95;
  if (days >= 4 && days <= 6 && /[3456]/.test(ideal)) return 0.9;
  if (days >= 7 && days <= 10 && /[567]/.test(ideal)) return 0.9;
  if (days >= 11) return 0.75;
  return 0.45;
}

function scoreSafety(dest: DestinationRecommendation): number {
  const s = dest.safetyNotes.toLowerCase();
  if (/tourist-friendly|generally safe|low crime/.test(s)) return 0.9;
  if (/caution|careful|precautions/.test(s)) return 0.7;
  if (/risk|unsafe|avoid/.test(s)) return 0.35;
  return 0.65;
}

function scoreAccessibility(
  dest: DestinationRecommendation,
  signals: ExpertPreferenceSignals,
): number {
  let score = 0.55;
  const notes = dest.transportNotes.toLowerCase();
  if (/nonstop|well connected|domestic/.test(notes)) score += 0.2;
  if (signals.visaPreference) {
    const v = signals.visaPreference.toLowerCase();
    if (v.includes("domestic") && dest.region === "india") score += 0.25;
    if ((v.includes("easy") || v.includes("voa") || v.includes("free")) && dest.region === "india") {
      score += 0.15;
    }
  }
  if (signals.region === "india" && dest.region === "india") score += 0.15;
  if (signals.region === "international" && dest.region === "international") score += 0.15;
  return clamp01(score);
}

function scoreCrowd(dest: DestinationRecommendation, signals: ExpertPreferenceSignals): number {
  const blob = destBlob(dest);
  const style = (signals.travelStyle ?? "").toLowerCase();
  if (style.includes("relax") || signals.interests.some((i) => /hidden|relax/.test(i))) {
    if (/quiet|hidden|unhurried|calm/.test(blob)) return 0.9;
    if (/nightlife|energy|party/.test(blob)) return 0.4;
  }
  if (signals.interests.some((i) => /nightlife|shopping/.test(i))) {
    if (/nightlife|market|energy/.test(blob)) return 0.85;
  }
  return 0.6;
}

function scoreValue(dest: DestinationRecommendation, signals: ExpertPreferenceSignals): number {
  const budget = signals.budgetInr;
  if (!budget) return 0.55;
  const mid = (dest.estimatedBudgetInr.min + dest.estimatedBudgetInr.max) / 2;
  if (mid > budget) return clamp01(0.4 - (mid - budget) / budget);
  // Good experiences within budget
  const headroom = (budget - mid) / budget;
  return clamp01(0.55 + headroom * 0.4);
}

/**
 * Score a catalog destination against preference signals.
 * Returns 0–100 match score. Breakdown is for tests/internal use only.
 */
export function scoreDestinationExpert(
  dest: DestinationRecommendation,
  signals: ExpertPreferenceSignals,
): { matchScore: number; breakdown: ExpertScoreBreakdown } {
  const interests = scoreInterests(dest, signals);
  const budget = scoreBudget(dest, signals);
  const weather = scoreWeather(dest, signals);
  const tripDuration = scoreDuration(dest, signals);
  const safety = scoreSafety(dest);
  const accessibility = scoreAccessibility(dest, signals);
  const crowdLevel = scoreCrowd(dest, signals);
  const valueForMoney = scoreValue(dest, signals);

  const w = EXPERT_SCORING_WEIGHTS;
  const total =
    interests * w.interests +
    budget * w.budget +
    weather * w.weather +
    tripDuration * w.tripDuration +
    safety * w.safety +
    accessibility * w.accessibility +
    crowdLevel * w.crowdLevel +
    valueForMoney * w.valueForMoney;

  // Keep scores in a readable 55–98 band for UX (avoid absurdly low equals).
  const matchScore = Math.max(55, Math.min(98, Math.round(total)));

  return {
    matchScore,
    breakdown: {
      interests: Math.round(interests * w.interests),
      budget: Math.round(budget * w.budget),
      weather: Math.round(weather * w.weather),
      tripDuration: Math.round(tripDuration * w.tripDuration),
      safety: Math.round(safety * w.safety),
      accessibility: Math.round(accessibility * w.accessibility),
      crowdLevel: Math.round(crowdLevel * w.crowdLevel),
      valueForMoney: Math.round(valueForMoney * w.valueForMoney),
      total: matchScore,
    },
  };
}

/** Ensure no ties — bump primary / nudge lower ranks so ranking is strict. */
export function breakScoreTies(
  ranked: Array<{ matchScore: number; slug: string }>,
): Array<{ matchScore: number; slug: string }> {
  const out = ranked.map((r) => ({ ...r }));
  for (let i = 1; i < out.length; i++) {
    if (out[i].matchScore >= out[i - 1].matchScore) {
      out[i].matchScore = Math.max(55, out[i - 1].matchScore - 1);
    }
  }
  return out;
}
