export {
  RECOMMENDATION_SESSION_KEY,
  RECOMMENDATION_SESSION_VERSION,
  type RecommendationContinuationIntent,
  type RecommendationFormState,
  type RecommendationSession,
} from "@/lib/recommendation-session/types";
export {
  clearRecommendationSession,
  loadRecommendationSession,
  persistRecommendationSession,
  syncLegacyHomepageDraft,
} from "@/lib/recommendation-session/storage";
export {
  continueRecommendationPlanning,
  tryConsumePendingRecommendation,
  type ContinueRecommendationResult,
} from "@/lib/recommendation-session/continuation";
