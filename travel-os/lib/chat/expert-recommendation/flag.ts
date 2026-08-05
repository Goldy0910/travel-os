/**
 * Expert Recommendation Mode — env toggle (mirrors RATE_LIMIT_ENABLED pattern).
 * Enabled by default. Set EXPERT_RECOMMENDATION_MODE=false to disable.
 */
export function isExpertRecommendationModeEnabled(): boolean {
  const raw = process.env.EXPERT_RECOMMENDATION_MODE?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  return true;
}
