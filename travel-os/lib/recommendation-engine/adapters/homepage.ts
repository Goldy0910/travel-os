import type {
  HomepageDecisionResponse,
  RecommendationPayload,
  ValidationFit,
  ValidationPayload,
} from "@/lib/homepage-decision/types";
import type { EngineResult, FitLevel } from "../types";

/** Map engine fit levels to legacy homepage validation labels. */
function toHomepageFit(fit: FitLevel): ValidationFit {
  if (fit === "moderate") return "okay";
  return fit;
}

export function engineResultToHomepagePayload(result: EngineResult): HomepageDecisionResponse {
  if (result.mode === "recommendation") {
    const payload: RecommendationPayload = {
      mode: "recommendation",
      destination: result.destination,
      destinationSlug: result.destinationSlug,
      canonicalLocation: result.canonicalLocation,
      whyItFits: result.whyItFits,
      travelEffort: result.travelEffort,
      budgetEstimate: result.budgetEstimate,
      itinerary: result.itinerary,
      alternatives: result.alternatives.map((a) => ({
        name: a.name,
        slug: a.slug,
        reason: a.reason,
      })),
      matchScore: result.fitScore,
      expertOpinion: `If I were planning this trip, I'd choose ${result.destination} — it scores highest for your time, budget, and priorities.`,
      decisionHelper: [
        {
          destination: result.destination,
          chooseIf: result.whyItFits.slice(0, 3),
        },
        ...result.alternatives.slice(0, 2).map((a) => ({
          destination: a.name,
          chooseIf: [a.reason],
        })),
      ],
    };
    return payload;
  }

  const payload: ValidationPayload = {
    mode: "validation",
    destination: result.destination,
    destinationSlug: result.destinationSlug,
    fit: toHomepageFit(result.fit),
    summary: result.summary,
    travelEffort: result.travelEffort,
    practicality: result.practicality,
    timeFit: result.timeFit,
    budgetRealism: result.budgetRealism,
    alternatives: result.alternatives.map((a) => ({
      name: a.name,
      slug: a.slug,
      reason: a.reason,
    })),
  };
  return payload;
}
