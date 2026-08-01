import type { ToolDefinition, ToolDescriptor } from "@/lib/tools/types";

const tools = new Map<string, ToolDefinition>();

function assertValidName(name: string) {
  if (!name || typeof name !== "string" || !/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(
      `Invalid tool name "${name}". Use lowercase snake_case starting with a letter.`,
    );
  }
}

/** Register (or replace) a tool by name. */
export function registerTool<TInput = unknown, TOutput = unknown>(
  tool: ToolDefinition<TInput, TOutput>,
): void {
  assertValidName(tool.name);
  if (!tool.description?.trim()) {
    throw new Error(`Tool "${tool.name}" requires a description`);
  }
  if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
    throw new Error(`Tool "${tool.name}" requires an inputSchema`);
  }
  if (typeof tool.handler !== "function") {
    throw new Error(`Tool "${tool.name}" requires a handler`);
  }
  tools.set(tool.name, tool as ToolDefinition);
}

export function unregisterTool(name: string): boolean {
  return tools.delete(name);
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function hasTool(name: string): boolean {
  return tools.has(name);
}

export function listTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

/** Handler-free descriptors for prompts / LLM function calling. */
export function listToolDescriptors(): ToolDescriptor[] {
  return listTools().map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}

/** Test / hot-reload helper. */
export function clearToolRegistry(): void {
  tools.clear();
}
