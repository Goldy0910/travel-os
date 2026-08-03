import { executeTool } from "@/lib/tools/execute";
import {
  listGeminiFunctionDeclarations,
  type GeminiFunctionDeclaration,
} from "@/lib/tools/gemini";
import { registerDefaultTools } from "@/lib/tools/register-defaults";
import type { ToolContext } from "@/lib/tools/types";
import type { ChatHistoryTurn } from "@/lib/chat/gemini-stream";
import { GEMINI_GENERATE_MODELS } from "@/lib/ai/gemini-models";
import { toolsLogger } from "@/lib/observability/logger";
import {
  chatStructuredGenerationConfig,
  parseStructuredChatResponse,
  type StructuredChatResponse,
} from "@/lib/chat/structured-response";

registerDefaultTools();

const MAX_TOOL_ROUNDS = 4;

type GeminiPart = {
  text?: string;
  functionCall?: { name?: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiCandidate = {
  content?: { parts?: GeminiPart[]; role?: string };
  finishReason?: string;
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("Generation cancelled");
    err.name = "AbortError";
    throw err;
  }
}

function historyToContents(history: ChatHistoryTurn[]): GeminiContent[] {
  return history.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));
}

function extractText(parts: GeminiPart[] | undefined): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

function extractFunctionCalls(
  parts: GeminiPart[] | undefined,
): Array<{ name: string; args: Record<string, unknown> }> {
  if (!Array.isArray(parts)) return [];
  const out: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const part of parts) {
    const name = part.functionCall?.name?.trim();
    if (!name) continue;
    const args =
      part.functionCall?.args && typeof part.functionCall.args === "object"
        ? part.functionCall.args
        : {};
    out.push({ name, args });
  }
  return out;
}

async function generateOnce(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  contents: GeminiContent[];
  tools?: GeminiFunctionDeclaration[];
  signal?: AbortSignal;
  /** JSON {response, entities} — only when not using function tools. */
  structuredOutput?: boolean;
}): Promise<{ parts: GeminiPart[]; finishReason?: string }> {
  throwIfAborted(input.signal);

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: input.systemPrompt }] },
    contents: input.contents,
    generationConfig:
      input.structuredOutput && !(input.tools && input.tools.length > 0)
        ? chatStructuredGenerationConfig()
        : { temperature: 0.7, maxOutputTokens: 2048 },
  };

  if (input.tools && input.tools.length > 0) {
    body.tools = [{ functionDeclarations: input.tools }];
    body.toolConfig = {
      functionCallingConfig: { mode: "AUTO" },
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    body: JSON.stringify(body),
    signal: input.signal,
  });

  const data = (await response.json().catch(() => null)) as
    | {
        candidates?: GeminiCandidate[];
        error?: { message?: string };
      }
    | null;

  if (!response.ok) {
    throw new Error(data?.error?.message?.trim() || `Gemini HTTP ${response.status}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return {
    parts,
    finishReason: data?.candidates?.[0]?.finishReason,
  };
}

export type ChatToolCallRecord = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

/**
 * Non-streaming Gemini turn with optional functionDeclarations.
 * Runs tool calls via the shared executeTool registry, then returns final text + entities.
 */
export async function generateChatWithTools(input: {
  systemPrompt: string;
  history: ChatHistoryTurn[];
  toolNames?: string[];
  toolContext?: ToolContext;
  signal?: AbortSignal;
}): Promise<{ text: string; entities: StructuredChatResponse["entities"]; toolCalls: ChatToolCallRecord[] }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const allDecls = listGeminiFunctionDeclarations();
  const allowed = input.toolNames?.length
    ? new Set(input.toolNames)
    : null;
  const tools = allowed
    ? allDecls.filter((d) => allowed.has(d.name))
    : allDecls;

  const contents = historyToContents(input.history);
  const toolCalls: ChatToolCallRecord[] = [];
  let lastError = "AI response unavailable";

  for (const model of GEMINI_GENERATE_MODELS) {
    throwIfAborted(input.signal);
    const roundContents = contents.map((c) => ({
      role: c.role,
      parts: [...c.parts],
    }));

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        throwIfAborted(input.signal);
        // After tools have run (or on first round), prefer structured JSON for the
        // user-facing reply. Keep tools enabled so the model can still call them.
        // Structured schema is only applied when we force a text-only follow-up.
        let parts: GeminiPart[];
        ({ parts } = await generateOnce({
          apiKey,
          model,
          systemPrompt: input.systemPrompt,
          contents: roundContents,
          tools: tools.length > 0 ? tools : undefined,
          signal: input.signal,
          structuredOutput: false,
        }));

        const calls = extractFunctionCalls(parts);
        if (calls.length === 0) {
          let text = extractText(parts);
          if (!text && toolCalls.length === 0) {
            lastError = "Empty AI response";
            break;
          }
          if (!text && toolCalls.length > 0) {
            const summary = toolCalls
              .map((c) => {
                const data = c.result as { ok?: boolean; data?: { message?: string }; error?: string };
                if (data && typeof data === "object") {
                  if (data.ok === false) return data.error || `${c.name} failed`;
                  if (data.data?.message) return data.data.message;
                }
                return `${c.name} completed`;
              })
              .join(" ");
            text = summary || "Done.";
          }

          // Parse structured {response, entities} when the model complies.
          // Do NOT make a second Gemini call (burns free-tier credits).
          const structured = parseStructuredChatResponse(text);
          return {
            text: structured.response || text,
            entities: structured.entities,
            toolCalls,
          };
        }

        toolsLogger.info("gemini_tool_round", {
          model,
          round,
          callCount: calls.length,
          names: calls.map((c) => c.name),
          tripId: input.toolContext?.tripId,
          conversationId: input.toolContext?.conversationId,
        });

        // Append model function-call turn
        roundContents.push({ role: "model", parts });

        const responseParts: GeminiPart[] = [];
        for (const call of calls) {
          throwIfAborted(input.signal);
          const needsTripIdFallback =
            (call.name === "generate_itinerary" ||
              call.name === "propose_itinerary_edits" ||
              call.name === "apply_itinerary_edits") &&
            !call.args.tripId &&
            Boolean(input.toolContext?.tripId);

          const result = await executeTool({
            name: call.name,
            args: {
              ...call.args,
              ...(needsTripIdFallback
                ? { tripId: input.toolContext!.tripId }
                : {}),
            },
            ctx: input.toolContext ?? {},
          });
          toolCalls.push({ name: call.name, args: call.args, result });
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: result as unknown as Record<string, unknown>,
            },
          });
        }
        roundContents.push({ role: "user", parts: responseParts });
      }

      lastError = "Tool calling exceeded maximum rounds";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      lastError = error instanceof Error ? error.message : "AI response unavailable";
    }
  }

  throw new Error(lastError);
}

export type ChatToolsStreamResult = {
  toolCalls: ChatToolCallRecord[];
  structured: StructuredChatResponse;
};

/**
 * Async generator wrapper so chat SSE can stream the final text after tools run.
 * Tool rounds are non-streaming; final assistant text is yielded in chunks.
 */
export async function* streamChatCompletionWithTools(input: {
  systemPrompt: string;
  history: ChatHistoryTurn[];
  toolNames?: string[];
  toolContext?: ToolContext;
  signal?: AbortSignal;
}): AsyncGenerator<string, ChatToolsStreamResult, unknown> {
  const { text, entities, toolCalls } = await generateChatWithTools(input);
  const structured: StructuredChatResponse = {
    response: text,
    entities,
  };
  if (!text) return { toolCalls, structured };

  // Yield in modest chunks so the UI still feels progressive after tool latency.
  const chunkSize = 48;
  for (let i = 0; i < text.length; i += chunkSize) {
    throwIfAborted(input.signal);
    yield text.slice(i, i + chunkSize);
  }
  return { toolCalls, structured };
}
