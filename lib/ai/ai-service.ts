import { createFallbackResponse, withRetries } from "@/lib/ai/fallback-handler";
import { routeIntentFromInput } from "@/lib/ai/intent-router";
import { buildIntentPrompt } from "@/lib/ai/prompt-generators";
import { parseAiStructuredResponse } from "@/lib/ai/response-parser";
import { getSystemPromptForIntent } from "@/lib/ai/system-prompts";
import type {
  AiExecutionState,
  AiIntentType,
  AiStructuredResponse,
  AiTripContext,
} from "@/lib/ai/types";

const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"] as const;

async function callGeminiWithFallback(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("Missing GEMINI_API_KEY");

  let lastMessage = "AI response unavailable";
  for (const model of GEMINI_MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2500 },
        }),
      },
    );
    const data = (await response.json().catch(() => null)) as
      | {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          error?: { message?: string };
        }
      | null;
    if (!response.ok) {
      lastMessage = data?.error?.message?.trim() || `Gemini HTTP ${response.status}`;
      continue;
    }
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) {
      lastMessage = "Empty AI response";
      continue;
    }
    return raw;
  }
  throw new Error(lastMessage);
}

export async function runAdaptiveAi(input: {
  message: string;
  context: AiTripContext;
  intent?: AiIntentType;
}): Promise<AiStructuredResponse> {
  const intent = input.intent ?? routeIntentFromInput(input.message);
  const systemPrompt = getSystemPromptForIntent(intent);
  const prompt = buildIntentPrompt({ userMessage: input.message, intent, context: input.context });
  try {
    const raw = await withRetries(() => callGeminiWithFallback(systemPrompt, prompt), {
      maxAttempts: 3,
      baseDelayMs: 250,
    });
    return parseAiStructuredResponse(raw);
  } catch {
    return createFallbackResponse(intent);
  }
}

export async function runAdaptiveAiWithState(input: {
  message: string;
  context: AiTripContext;
  intent?: AiIntentType;
}): Promise<AiExecutionState> {
  try {
    const response = await runAdaptiveAi(input);
    return { status: "success", response };
  } catch (error) {
    const intent = input.intent ?? routeIntentFromInput(input.message);
    const fallbackResponse = createFallbackResponse(intent);
    const message = error instanceof Error ? error.message : "Unknown AI error";
    return { status: "error", message, fallbackResponse };
  }
}
