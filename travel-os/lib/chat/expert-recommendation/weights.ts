/** Weighted factors for expert destination scoring (sum = 100). Do not expose raw math to users. */
export const EXPERT_SCORING_WEIGHTS = {
  interests: 30,
  budget: 20,
  weather: 15,
  tripDuration: 10,
  safety: 10,
  accessibility: 5,
  crowdLevel: 5,
  valueForMoney: 5,
} as const;

export type ExpertScoringWeights = typeof EXPERT_SCORING_WEIGHTS;
