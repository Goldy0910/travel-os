export type { KnowledgeChunk, KnowledgeTopic, RetrievedChunk, DestinationKnowledgeResult } from "@/lib/destination-knowledge/types";
export { buildKnowledgeCorpus } from "@/lib/destination-knowledge/corpus";
export {
  detectDestinationKnowledgeIntent,
  detectDestinationMentions,
  detectKnowledgeTopics,
  resolveDestinationSlugs,
  retrieveDestinationKnowledge,
} from "@/lib/destination-knowledge/retrieve";
export {
  buildKnowledgeAnswerPrompt,
  streamDestinationKnowledgeAnswer,
  DESTINATION_KNOWLEDGE_SYSTEM_PROMPT,
} from "@/lib/destination-knowledge/answer";
