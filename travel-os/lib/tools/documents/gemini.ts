import { GEMINI_GENERATE_MODELS } from "@/lib/ai/gemini-models";


export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/**
 * Non-streaming Gemini generateContent for scoped document tools.
 * Keeps prompts small and temperature low for factual summaries.
 */
export async function generateDocumentAiText(input: {
  systemPrompt: string;
  parts: GeminiPart[];
  signal?: AbortSignal;
  maxOutputTokens?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  let lastError = "AI response unavailable";
  for (const model of GEMINI_GENERATE_MODELS) {
    if (input.signal?.aborted) {
      const err = new Error("Generation cancelled");
      err.name = "AbortError";
      throw err;
    }
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: input.systemPrompt }] },
            contents: [{ role: "user", parts: input.parts }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: input.maxOutputTokens ?? 1024,
            },
          }),
          signal: input.signal,
        },
      );
      const data = (await response.json().catch(() => null)) as
        | {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            error?: { message?: string };
          }
        | null;
      if (!response.ok) {
        lastError = data?.error?.message?.trim() || `Gemini HTTP ${response.status}`;
        continue;
      }
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((p) => (typeof p?.text === "string" ? p.text : ""))
        .join("")
        .trim();
      if (text) return text;
      lastError = "Empty AI response";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      lastError = error instanceof Error ? error.message : "AI response unavailable";
    }
  }
  throw new Error(lastError);
}
