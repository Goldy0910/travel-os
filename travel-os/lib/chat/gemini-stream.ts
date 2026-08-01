import { GEMINI_GENERATE_MODELS } from "@/lib/ai/gemini-models";

export type ChatHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

function extractSseTextDelta(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = root.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("Generation cancelled");
    err.name = "AbortError";
    throw err;
  }
}

async function* streamGeminiModel(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  history: ChatHistoryTurn[];
  signal?: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
  throwIfAborted(input.signal);

  const contents = input.history.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:streamGenerateContent?alt=sse`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    const message = data?.error?.message?.trim() || `Gemini HTTP ${response.status}`;
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Empty Gemini stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      throwIfAborted(input.signal);
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n");
      buffer = chunks.pop() ?? "";

      for (const line of chunks) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as unknown;
          const delta = extractSseTextDelta(parsed);
          if (delta) yield delta;
        } catch {
          // Ignore malformed SSE frames
        }
      }
    }

    if (buffer.trim().startsWith("data:")) {
      const data = buffer.trim().slice(5).trim();
      if (data && data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data) as unknown;
          const delta = extractSseTextDelta(parsed);
          if (delta) yield delta;
        } catch {
          // ignore
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

export async function* streamChatCompletion(input: {
  systemPrompt: string;
  history: ChatHistoryTurn[];
  signal?: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  let lastError = "AI response unavailable";
  for (const model of GEMINI_GENERATE_MODELS) {
    throwIfAborted(input.signal);
    try {
      yield* streamGeminiModel({
        apiKey,
        model,
        systemPrompt: input.systemPrompt,
        history: input.history,
        signal: input.signal,
      });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      lastError = error instanceof Error ? error.message : "AI response unavailable";
    }
  }
  throw new Error(lastError);
}

export async function generateChatTitle(
  firstUserMessage: string,
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const fallback = firstUserMessage.trim().slice(0, 48) || "New chat";
  if (!apiKey) return fallback;

  const prompt = `Create a short conversation title (max 6 words) for this chat opener. Return ONLY the title text, no quotes or punctuation wrappers.

User message:
${firstUserMessage.trim().slice(0, 500)}`;

  for (const model of GEMINI_GENERATE_MODELS) {
    throwIfAborted(signal);
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
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 24 },
          }),
          signal,
        },
      );
      const data = (await response.json().catch(() => null)) as
        | {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          }
        | null;
      if (!response.ok) continue;
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!raw) continue;
      const cleaned = raw
        .replace(/^["'`]+|["'`]+$/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);
      if (cleaned) return cleaned;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      // try next model
    }
  }
  return fallback;
}
