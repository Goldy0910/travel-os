import { toChatDestinationCard } from "@/lib/chat/destination-cards";
import { DESTINATION_CATALOG } from "@/lib/find-destination/catalog";
import { buildExpertRecommendation } from "./build";
import type { ExpertChatDestinationCard, ExpertPreferenceSignals } from "./types";

/**
 * Build rich chat cards from an expert ranking.
 * Only includes catalog-matched destinations from candidateNames when provided
 * (avoids mismatched generic catalog fallback under an unrelated AI reply).
 */
export function buildExpertChatCards(input: {
  signals: ExpertPreferenceSignals;
  candidateNames: string[];
  expertOpinion?: string;
}): ExpertChatDestinationCard[] {
  if (!input.candidateNames.length) return [];

  const result = buildExpertRecommendation({
    signals: input.signals,
    candidateNames: input.candidateNames,
    limit: 3,
  });
  if (!result) return [];

  const ranked = [result.primary, ...result.alternatives];
  const opinion = input.expertOpinion ?? result.expertOpinion;

  return ranked.map((row, index) => {
    const catalog = DESTINATION_CATALOG.find((d) => d.slug === row.slug);
    if (!catalog) {
      // Shouldn't happen when candidateNames matched catalog, but stay safe.
      return null;
    }
    const base = toChatDestinationCard(
      catalog,
      row.role === "primary" ? row.summary : row.summary,
    );
    const card: ExpertChatDestinationCard = {
      ...base,
      matchScore: row.matchScore,
      role: row.role,
      whyReasons: row.whyReasons,
      rankedLowerReasons: row.rankedLowerReasons,
      chooseIf: row.chooseIf,
      matchNote:
        row.role === "primary"
          ? `${row.matchScore}% Match · ${row.summary}`
          : `${row.matchScore}% Match · ${row.summary}`,
    };
    if (index === 0) {
      card.expertOpinion = opinion;
    }
    return card;
  }).filter((c): c is ExpertChatDestinationCard => c != null);
}
