import { DESTINATION_CATALOG } from "@/lib/find-destination/catalog";
import type { DestinationRecommendation } from "@/app/find-destination/_lib/types";
import type {
  BudgetTier,
  ChatDestinationCard,
} from "@/lib/chat/destination-card-types";
import type { ConversationMemoryFields } from "@/lib/chat/memory-types";

/** India-passport oriented extras for chat cards (not trip data). */
const DESTINATION_EXTRAS: Record<
  string,
  { visa: string; flightDuration: string }
> = {
  "goa-india": { visa: "Domestic — no visa", flightDuration: "1.5–2.5 hrs from major hubs" },
  "manali-india": { visa: "Domestic — no visa", flightDuration: "Fly to KUU ~1.5 hrs + road" },
  "jaipur-india": { visa: "Domestic — no visa", flightDuration: "~1–1.5 hrs from Delhi" },
  "rishikesh-india": { visa: "Domestic — no visa", flightDuration: "DED/DEL + 5–7 hrs road" },
  "udaipur-india": { visa: "Domestic — no visa", flightDuration: "~1.5–2 hrs from Delhi/Mumbai" },
  "andaman-india": { visa: "Domestic — no visa", flightDuration: "~2.5–3 hrs to Port Blair" },
  "bali-indonesia": { visa: "VOA / e-VOA for Indians", flightDuration: "~9–12 hrs (1 stop typical)" },
  "dubai-uae": { visa: "e-Visa common for Indians", flightDuration: "~3.5–4 hrs nonstop" },
  "singapore": { visa: "e-Visa / VOA rules vary", flightDuration: "~5.5–6.5 hrs nonstop" },
  "bangkok-thailand": { visa: "VOA / exemption windows vary", flightDuration: "~4–4.5 hrs nonstop" },
  "maldives": { visa: "Free VOA on arrival", flightDuration: "~4–5.5 hrs nonstop" },
  "paris-france": { visa: "Schengen visa required", flightDuration: "~9–11 hrs (1 stop typical)" },
  "tokyo-japan": { visa: "Japan e-visa / embassy", flightDuration: "~8–11 hrs (1 stop typical)" },
  "kerala-india": { visa: "Domestic — no visa", flightDuration: "~2–3 hrs to COK/TRV" },
  "leh-ladakh-india": { visa: "Domestic — no visa", flightDuration: "~1.5 hrs to IXL + acclimatize" },
};

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

function budgetTier(min: number, max: number): BudgetTier {
  const mid = (min + max) / 2;
  if (mid < 45000) return "budget";
  if (mid < 120000) return "moderate";
  return "premium";
}

function budgetTierLabel(tier: BudgetTier): string {
  if (tier === "budget") return "Budget-friendly";
  if (tier === "moderate") return "Mid-range";
  return "Premium";
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchCatalogEntry(name: string): DestinationRecommendation | null {
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

function scoreForMemory(dest: DestinationRecommendation, memory: ConversationMemoryFields): number {
  let score = 40;
  const blob = `${dest.shortDescription} ${dest.overview} ${dest.travelStyle} ${dest.topAttractions.join(" ")} ${dest.weatherSummary}`.toLowerCase();

  for (const interest of memory.interests) {
    if (blob.includes(interest.toLowerCase())) score += 6;
  }
  if (memory.weather_preference) {
    const w = memory.weather_preference.toLowerCase();
    if (blob.includes(w) || dest.weatherSummary.toLowerCase().includes(w.split(/\s+/)[0] ?? w)) {
      score += 8;
    }
  }
  if (memory.budget) {
    const digits = memory.budget.replace(/[^\d]/g, "");
    const budgetNum = digits ? Number(digits) : NaN;
    if (Number.isFinite(budgetNum) && budgetNum > 0) {
      const mid = (dest.estimatedBudgetInr.min + dest.estimatedBudgetInr.max) / 2;
      const delta = Math.abs(mid - budgetNum) / budgetNum;
      score += Math.max(0, 14 - delta * 18);
    }
  }
  if (memory.visa_preference) {
    const v = memory.visa_preference.toLowerCase();
    const extras = DESTINATION_EXTRAS[dest.slug];
    const visaText = (extras?.visa ?? "").toLowerCase();
    if (v.includes("domestic") && dest.region === "india") score += 10;
    if ((v.includes("easy") || v.includes("voa") || v.includes("free")) && /voa|free|domestic|e-visa|evisa/.test(visaText)) {
      score += 8;
    }
    if (v.includes("schengen") && visaText.includes("schengen")) score += 6;
  }
  if (memory.travel_duration) {
    const d = memory.travel_duration.toLowerCase();
    if (d.includes("weekend") && dest.idealDuration.includes("3")) score += 4;
    if ((d.includes("week") || d.includes("7")) && dest.idealDuration.includes("7")) score += 4;
  }
  return score;
}

export function toChatDestinationCard(
  dest: DestinationRecommendation,
  matchNote?: string,
): ChatDestinationCard {
  const tier = budgetTier(dest.estimatedBudgetInr.min, dest.estimatedBudgetInr.max);
  const extras = DESTINATION_EXTRAS[dest.slug] ?? {
    visa: dest.region === "india" ? "Domestic — no visa" : "Check current visa rules",
    flightDuration: dest.transportNotes.slice(0, 80) || "Varies by origin",
  };

  return {
    id: dest.slug,
    slug: dest.slug,
    name: dest.name,
    country: dest.country,
    heroImageUrl: dest.imageUrl,
    budgetTier: tier,
    budgetLabel: `${budgetTierLabel(tier)} · ${formatInr(dest.estimatedBudgetInr.min)}–${formatInr(dest.estimatedBudgetInr.max)}`,
    weather: dest.weatherSummary,
    visa: extras.visa,
    flightDuration: extras.flightDuration,
    bestMonths: dest.bestMonths.slice(0, 6),
    highlights: dest.topAttractions.slice(0, 4),
    matchNote: matchNote ?? dest.whyItMatches,
  };
}

/**
 * Build inline recommendation cards for Discovery (no itinerary).
 * Prefers harvested candidate names; otherwise ranks catalog from memory.
 */
export function buildChatDestinationCards(input: {
  memory: ConversationMemoryFields;
  candidateNames?: string[];
  limit?: number;
}): ChatDestinationCard[] {
  const limit = input.limit ?? 4;
  const fromNames: ChatDestinationCard[] = [];

  for (const name of input.candidateNames ?? []) {
    const match = matchCatalogEntry(name);
    if (!match) continue;
    if (fromNames.some((c) => c.slug === match.slug)) continue;
    fromNames.push(toChatDestinationCard(match));
    if (fromNames.length >= limit) return fromNames;
  }

  if (fromNames.length >= Math.min(3, limit)) return fromNames;

  const ranked = [...DESTINATION_CATALOG]
    .map((dest) => ({ dest, score: scoreForMemory(dest, input.memory) }))
    .sort((a, b) => b.score - a.score);

  for (const { dest, score } of ranked) {
    if (fromNames.some((c) => c.slug === dest.slug)) continue;
    fromNames.push(
      toChatDestinationCard(dest, score >= 70 ? "Strong fit for your preferences" : dest.whyItMatches),
    );
    if (fromNames.length >= limit) break;
  }

  return fromNames;
}
