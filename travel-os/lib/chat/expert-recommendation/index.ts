export { isExpertRecommendationModeEnabled } from "./flag";
export { EXPERT_SCORING_WEIGHTS } from "./weights";
export type {
  ExpertChatDestinationCard,
  ExpertPreferenceSignals,
  ExpertRankedDestination,
  ExpertRecommendationResult,
  ExpertScoreBreakdown,
} from "./types";
export {
  signalsFromConversationMemory,
  signalsFromQuizAnswers,
} from "./signals";
export {
  extractMentionedDestination,
  wantsFullOptionsList,
} from "./detect";
export {
  breakScoreTies,
  scoreDestinationExpert,
} from "./score";
export {
  buildExpertRecommendation,
  hasEnoughSignalsForRecommendation,
  matchCatalogByName,
} from "./build";
export {
  EXPERT_RECOMMENDATION_BYPASS_NOTE,
  EXPERT_RECOMMENDATION_PROMPT_ADDENDUM,
} from "./prompt";
export {
  buildExpertChatCards,
} from "./cards";
