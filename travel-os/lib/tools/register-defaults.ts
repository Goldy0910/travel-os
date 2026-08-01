import { applyItineraryEditsTool } from "@/lib/tools/definitions/apply-itinerary-edits";
import { createTripTool } from "@/lib/tools/definitions/create-trip";
import { documentTools } from "@/lib/tools/definitions/documents";
import { expenseTools } from "@/lib/tools/definitions/expenses";
import { generateItineraryTool } from "@/lib/tools/definitions/generate-itinerary";
import { getCompanionContextTool } from "@/lib/tools/definitions/get-companion-context";
import { memberTools } from "@/lib/tools/definitions/members";
import { proposeItineraryEditsTool } from "@/lib/tools/definitions/propose-itinerary-edits";
import { queryGuideTool } from "@/lib/tools/definitions/query-guide";
import {
  getTripMemoryTool,
  updateTripMemoryTool,
} from "@/lib/tools/definitions/trip-memory";
import { updateTripTool } from "@/lib/tools/definitions/update-trip";
import { registerTool } from "@/lib/tools/registry";
import type { ToolDefinition } from "@/lib/tools/types";

/** Built-in tools registered on `@/lib/tools` import. */
export const DEFAULT_TOOLS: ToolDefinition[] = [
  createTripTool as ToolDefinition,
  updateTripTool as ToolDefinition,
  generateItineraryTool as ToolDefinition,
  proposeItineraryEditsTool as ToolDefinition,
  applyItineraryEditsTool as ToolDefinition,
  queryGuideTool as ToolDefinition,
  getCompanionContextTool as ToolDefinition,
  getTripMemoryTool as ToolDefinition,
  updateTripMemoryTool as ToolDefinition,
  ...(documentTools as ToolDefinition[]),
  ...(expenseTools as ToolDefinition[]),
  ...memberTools,
];

let defaultsRegistered = false;

/** Idempotent registration of the built-in tool set (always refreshes handlers). */
export function registerDefaultTools(): void {
  for (const tool of DEFAULT_TOOLS) {
    registerTool(tool);
  }
  defaultsRegistered = true;
}

/** Force re-register defaults (tests / hot reload). */
export function reregisterDefaultTools(): void {
  defaultsRegistered = false;
  for (const tool of DEFAULT_TOOLS) {
    registerTool(tool);
  }
  defaultsRegistered = true;
}
