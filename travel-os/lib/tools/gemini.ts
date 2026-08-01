import { listToolDescriptors } from "@/lib/tools/registry";
import type { JsonSchema, ToolDescriptor } from "@/lib/tools/types";

/**
 * Gemini `functionDeclarations` entry shape (subset used by generateContent).
 * Ready for chat/Gemini wiring — not attached to streams yet.
 */
export type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters: JsonSchema;
};

export function toolDescriptorToGeminiFunction(
  tool: ToolDescriptor,
): GeminiFunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  };
}

/** Build Gemini tools config from the current registry. */
export function listGeminiFunctionDeclarations(): GeminiFunctionDeclaration[] {
  return listToolDescriptors().map(toolDescriptorToGeminiFunction);
}
