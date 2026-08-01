import { streamChatCompletion } from "@/lib/chat/gemini-stream";
import type { DestinationKnowledgeResult } from "@/lib/destination-knowledge/types";

export const DESTINATION_KNOWLEDGE_SYSTEM_PROMPT = `You are the Destination Knowledge assistant for Travel Till 99.
Answer using ONLY the retrieved destination knowledge context when possible.
If context is incomplete, say what is known and what should be verified (especially visas and live prices).
Keep answers practical and concise.
Support comparisons, cost, safety/solo travel, internet quality, local transport, food, nightlife, and family-friendliness.
Do NOT create trips, itineraries, day plans, or booking claims.
This module is independent from trip planning.
Use light Markdown when helpful.`;

export function buildKnowledgeAnswerPrompt(result: DestinationKnowledgeResult): string {
  return `${DESTINATION_KNOWLEDGE_SYSTEM_PROMPT}

Retrieved destination knowledge (RAG context):
${result.contextText}

Detected destinations: ${result.destinations.join(", ") || "unspecified"}
Detected topics: ${result.topics.join(", ")}

Answer the user question grounded in the retrieved context.`;
}

export async function* streamDestinationKnowledgeAnswer(input: {
  question: string;
  retrieval: DestinationKnowledgeResult;
  signal?: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
  const systemPrompt = buildKnowledgeAnswerPrompt(input.retrieval);
  yield* streamChatCompletion({
    systemPrompt,
    history: [{ role: "user", content: input.question }],
    signal: input.signal,
  });
}
