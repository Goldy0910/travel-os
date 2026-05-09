import type { AiStructuredResponse } from "@/lib/ai/types";

function parseLooseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/```json|```/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error("Invalid AI JSON response");
  }
}

export function parseAiStructuredResponse(raw: string): AiStructuredResponse {
  const parsed = parseLooseJson<Partial<AiStructuredResponse>>(raw);
  return {
    message: typeof parsed.message === "string" ? parsed.message.trim() : "",
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    updatedItinerary: Array.isArray(parsed.updatedItinerary) ? parsed.updatedItinerary : [],
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "",
    followUpQuestion:
      typeof parsed.followUpQuestion === "string" ? parsed.followUpQuestion.trim() : "",
  };
}
