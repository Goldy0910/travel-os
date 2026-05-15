/** Weighted factors (sum = 100). Tune without changing call sites. */
export const SCORING_WEIGHTS = {
  timeFit: 25,
  budgetFit: 20,
  preferenceAlignment: 25,
  travelPracticality: 15,
  seasonalFit: 10,
  effortPenalty: 5,
} as const;

export type ScoringWeights = typeof SCORING_WEIGHTS;
