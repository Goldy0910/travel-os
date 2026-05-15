/**
 * TravelTill99 recommendation engine — public API.
 * Structured scoring, recommendation, and validation (not free-form AI text).
 */

export type {
  EngineResult,
  RecommendationResult,
  ValidationResult,
  TripPreferences,
  ScoredDestination,
  ScoreBreakdown,
  FitLevel,
  AlternativePick,
} from "./types";

export type { DestinationMetadata, DestinationScores } from "./models/destination";
export { DESTINATION_SEED } from "./data/destinations.seed";
export { ORIGIN_CITIES, DEFAULT_ORIGIN_SLUG } from "./data/origin-cities.seed";
export { SCORING_WEIGHTS } from "./scoring/weights";

export {
  findDestinationByInput,
  findOriginCitySlug,
  getDestinationBySlug,
  listAllDestinations,
} from "./utils/resolve";

export { scoreDestination } from "./scoring/score-destination";
export { rankDestinations, topDestinationsForPrefs } from "./scoring/rank-destinations";
export { recommendDestinations } from "./recommendation/recommend";
export { validateDestinationInput } from "./validation/validate-destination";

import type { EngineResult, TripPreferences } from "./types";
import { recommendDestinations } from "./recommendation/recommend";
import { validateDestinationInput } from "./validation/validate-destination";

/** Primary entry: route to recommend or validate based on optional destination input. */
export function runRecommendationEngine(prefs: TripPreferences): EngineResult {
  if (prefs.destination?.trim()) {
    return validateDestinationInput(prefs);
  }
  return recommendDestinations(prefs);
}
