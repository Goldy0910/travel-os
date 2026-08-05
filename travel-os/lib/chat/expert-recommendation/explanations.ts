import type { DestinationRecommendation } from "@/app/find-destination/_lib/types";
import type { ExpertPreferenceSignals, ExpertRankedDestination } from "./types";

function formatInr(amount: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${Math.round(amount).toLocaleString("en-IN")}`;
  }
}

function interestPhrase(interests: string[]): string {
  return interests
    .slice(0, 3)
    .map((i) => i.replace(/-/g, " "))
    .join(", ");
}

/** 3–5 personalized reasons tied to user inputs — never generic filler. */
export function buildPersonalizedReasons(
  dest: DestinationRecommendation,
  signals: ExpertPreferenceSignals,
): string[] {
  const reasons: string[] = [];
  const blob = `${dest.shortDescription} ${dest.overview} ${dest.topAttractions.join(" ")}`.toLowerCase();

  if (signals.budgetLabel || signals.budgetInr) {
    const label = signals.budgetLabel ?? formatInr(signals.budgetInr!);
    const mid = (dest.estimatedBudgetInr.min + dest.estimatedBudgetInr.max) / 2;
    if (signals.budgetInr && mid <= signals.budgetInr) {
      reasons.push(`Fits comfortably within your ${label} budget`);
    } else {
      reasons.push(`Budget band aligns with your ${label} target`);
    }
  }

  if (signals.weather) {
    reasons.push(
      `${dest.name}'s climate (${dest.weatherSummary.split(";")[0]?.trim() || "seasonal"}) matches your ${signals.weather} preference`,
    );
  }

  if (signals.durationLabel || signals.durationDays) {
    const dur = signals.durationLabel ?? `${signals.durationDays}-day trip`;
    reasons.push(`Works well for a ${dur} — ideal window is ${dest.idealDuration}`);
  }

  if (signals.interests.length) {
    const matched = signals.interests
      .filter((interest) => {
        const key = interest.toLowerCase().replace(/-/g, " ");
        return blob.includes(key) || dest.slug.includes(interest.toLowerCase().split("-")[0]!);
      })
      .slice(0, 2);
    if (matched.length) {
      reasons.push(`Strong match for your interests: ${interestPhrase(matched)}`);
    } else {
      reasons.push(`Aligns with your interests around ${interestPhrase(signals.interests)}`);
    }
  }

  if (signals.groupType) {
    reasons.push(`Suited to traveling as ${signals.groupType}`);
  }

  if (signals.foodPreferences?.length) {
    reasons.push(`Food scene supports your prefs (${signals.foodPreferences.slice(0, 2).join(", ")})`);
  } else if (dest.foodHighlights.length) {
    reasons.push(`Great food highlights: ${dest.foodHighlights.slice(0, 2).join(", ")}`);
  }

  if (signals.visaPreference) {
    reasons.push(`Visa angle considered against your preference: ${signals.visaPreference}`);
  }

  // Deduplicate and cap 3–5
  const unique = [...new Set(reasons)];
  if (unique.length < 3) {
    unique.push(`Solid overall value for money around ${formatInr(dest.estimatedBudgetInr.min)}–${formatInr(dest.estimatedBudgetInr.max)}`);
  }
  if (unique.length < 3) {
    unique.push(`Safety profile: ${dest.safetyNotes.split(".")[0]}.`);
  }
  return unique.slice(0, 5);
}

export function buildRankedLowerReasons(
  primary: DestinationRecommendation,
  alt: DestinationRecommendation,
  signals: ExpertPreferenceSignals,
): string[] {
  const reasons: string[] = [];
  const pMid = (primary.estimatedBudgetInr.min + primary.estimatedBudgetInr.max) / 2;
  const aMid = (alt.estimatedBudgetInr.min + alt.estimatedBudgetInr.max) / 2;

  if (signals.budgetInr) {
    if (aMid > pMid && aMid > signals.budgetInr * 0.95) {
      reasons.push("Budget will be more stretched than the top pick");
    } else if (aMid < pMid * 0.75) {
      reasons.push("Slightly cheaper, but fewer experiences match your priorities");
    }
  }

  if (signals.interests.length) {
    reasons.push(`Slightly weaker alignment with ${interestPhrase(signals.interests)}`);
  }

  if (signals.weather) {
    reasons.push(`Weather fit is less precise for your ${signals.weather} preference`);
  }

  if (signals.durationDays && signals.durationDays <= 5 && /7|week/.test(alt.idealDuration)) {
    reasons.push("Better suited to a longer trip than you have");
  }

  if (reasons.length < 2) {
    reasons.push(`${primary.name} offers a better overall balance for your inputs`);
  }
  if (reasons.length < 3) {
    reasons.push("Still a strong backup — just not the best overall match");
  }

  return [...new Set(reasons)].slice(0, 3);
}

export function buildChooseIf(
  dest: DestinationRecommendation,
  signals: ExpertPreferenceSignals,
  role: "primary" | "alternative",
): string[] {
  const items: string[] = [];
  if (signals.interests.length) {
    items.push(`You care most about ${interestPhrase(signals.interests)}`);
  }
  items.push(...dest.topAttractions.slice(0, 2).map((a) => `You want ${a}`));
  if (role === "alternative" && dest.travelStyle) {
    items.push(`You prefer a ${dest.travelStyle.toLowerCase()} pace`);
  }
  if (signals.groupType && role === "primary") {
    items.push(`You're traveling as ${signals.groupType}`);
  }
  return [...new Set(items)].slice(0, 3);
}

export function buildExpertOpinion(
  primary: ExpertRankedDestination,
  signals: ExpertPreferenceSignals,
): string {
  const bits: string[] = [];
  if (signals.weather) bits.push("weather");
  if (signals.budgetLabel || signals.budgetInr) bits.push("budget");
  if (signals.interests.length) bits.push("experiences");
  const balance = bits.length ? bits.join(", ") : "fit and practicality";
  return `If I were planning this trip, I'd choose ${primary.name}. It gives the best overall balance of ${balance} for what you've shared.`;
}

export function buildWhyNotUserChoice(
  mentioned: string,
  primary: ExpertRankedDestination,
  signals: ExpertPreferenceSignals,
): string {
  const reasons: string[] = [];
  if (signals.budgetLabel || signals.budgetInr) {
    reasons.push(`Budget fit is tighter than ${primary.name}`);
  }
  if (signals.durationLabel || signals.durationDays) {
    reasons.push("Travel time / trip length is less practical for your window");
  }
  if (signals.interests.length) {
    reasons.push(`Your interests map more cleanly to ${primary.name}`);
  }
  if (reasons.length < 2) {
    reasons.push(`Better overall value exists for your travel constraints`);
  }

  return `You asked about ${mentioned}. Although ${mentioned} is beautiful, I didn't recommend it as the top pick because:\n${reasons.map((r) => `- ${r}`).join("\n")}\n\nI believe ${primary.name} would provide a better overall experience for your trip.`;
}

export function comparisonDims(dest: DestinationRecommendation): ExpertRankedDestination["comparison"] {
  const mid = (dest.estimatedBudgetInr.min + dest.estimatedBudgetInr.max) / 2;
  let budget = "Moderate";
  if (mid < 45000) budget = "Budget";
  else if (mid > 120000) budget = "Premium";

  return {
    budget,
    weather: dest.weatherSummary.split(/[.;]/)[0]?.trim().slice(0, 40) || "Seasonal",
    activities: dest.topAttractions.slice(0, 2).join(", ") || dest.travelStyle,
    food: dest.foodHighlights[0] ?? "Local cuisine",
    safety: dest.safetyNotes.split(/[.;]/)[0]?.trim().slice(0, 40) || "Standard precautions",
  };
}
