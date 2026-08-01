import { createRequestId, toolsLogger } from "@/lib/observability/logger";
import { checkToolRateLimit } from "@/lib/rate-limit";
import { getTool } from "@/lib/tools/registry";
import { validateAgainstSchema } from "@/lib/tools/schema";
import type { ToolContext, ToolResult } from "@/lib/tools/types";

export type ExecuteToolInput = {
  name: string;
  args?: unknown;
  ctx?: ToolContext;
};

/**
 * Validate args against the tool's input schema, then invoke the handler.
 * Never throws for unknown tools / bad input / handler errors — returns ToolResult.
 */
export async function executeTool(input: ExecuteToolInput): Promise<ToolResult> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    return { ok: false, error: "Tool name is required", code: "INVALID_INPUT" };
  }

  const tool = getTool(name);
  if (!tool) {
    toolsLogger.warn("tool_not_found", { requestId, name });
    return { ok: false, error: `Unknown tool: ${name}`, code: "TOOL_NOT_FOUND" };
  }

  const rate = checkToolRateLimit(input.ctx?.userId, name);
  if (!rate.allowed) {
    toolsLogger.warn("tool_rate_limited", {
      requestId,
      name,
      userId: input.ctx?.userId,
      retryAfterMs: rate.retryAfterMs,
    });
    return {
      ok: false,
      error: "Too many tool requests. Please wait a moment and try again.",
      code: "RATE_LIMITED",
      details: { retryAfterMs: rate.retryAfterMs },
    };
  }

  const validation = validateAgainstSchema(tool.inputSchema, input.args ?? {});
  if (!validation.ok) {
    toolsLogger.info("tool_invalid_input", {
      requestId,
      name,
      path: validation.path,
      error: validation.error,
    });
    return {
      ok: false,
      error: validation.error,
      code: "INVALID_INPUT",
      details: { path: validation.path },
    };
  }

  toolsLogger.info("tool_call_start", {
    requestId,
    name,
    userId: input.ctx?.userId,
    conversationId: input.ctx?.conversationId,
    tripId: input.ctx?.tripId,
  });

  try {
    const result = await tool.handler(validation.data, input.ctx ?? {});
    if (!result || typeof result !== "object" || typeof (result as ToolResult).ok !== "boolean") {
      toolsLogger.error("tool_invalid_result", { requestId, name });
      return {
        ok: false,
        error: `Tool "${name}" returned an invalid result shape`,
        code: "HANDLER_ERROR",
      };
    }
    toolsLogger.info("tool_call_complete", {
      requestId,
      name,
      ok: result.ok,
      code: result.ok ? undefined : result.code,
      elapsedMs: Date.now() - startedAt,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    toolsLogger.error("tool_call_error", {
      requestId,
      name,
      error: err,
      elapsedMs: Date.now() - startedAt,
    });
    return { ok: false, error: message, code: "HANDLER_ERROR" };
  }
}

/** Convenience: execute by name + args. */
export async function runTool(
  name: string,
  args?: unknown,
  ctx?: ToolContext,
): Promise<ToolResult> {
  return executeTool({ name, args, ctx });
}
