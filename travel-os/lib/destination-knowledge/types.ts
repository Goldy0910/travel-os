export type KnowledgeTopic =
  | "overview"
  | "cost"
  | "safety"
  | "solo"
  | "internet"
  | "transport"
  | "food"
  | "nightlife"
  | "family"
  | "weather"
  | "visa"
  | "compare";

export type KnowledgeChunk = {
  id: string;
  destinationSlug: string;
  destinationName: string;
  country: string;
  topic: KnowledgeTopic;
  title: string;
  content: string;
};

export type EmbeddedChunk = KnowledgeChunk & {
  embedding: number[];
};

export type RetrievedChunk = KnowledgeChunk & {
  score: number;
};

export type DestinationKnowledgeResult = {
  question: string;
  destinations: string[];
  topics: KnowledgeTopic[];
  chunks: RetrievedChunk[];
  contextText: string;
};
