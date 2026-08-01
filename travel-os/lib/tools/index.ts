import { documentTools } from "@/lib/tools/definitions/documents";
import { expenseTools } from "@/lib/tools/definitions/expenses";
import { memberTools } from "@/lib/tools/definitions/members";
import { registerDefaultTools } from "@/lib/tools/register-defaults";
import { hasTool, registerTool } from "@/lib/tools/registry";

// Ensure built-in tools are available when consumers import from `@/lib/tools`.
registerDefaultTools();
for (const tool of documentTools) {
  if (!hasTool(tool.name)) {
    registerTool(tool);
  }
}
for (const tool of expenseTools) {
  if (!hasTool(tool.name)) {
    registerTool(tool);
  }
}
for (const tool of memberTools) {
  if (!hasTool(tool.name)) {
    registerTool(tool);
  }
}
export type {
  JsonSchema,
  JsonSchemaType,
  ToolContext,
  ToolDefinition,
  ToolDescriptor,
  ToolFailure,
  ToolHandler,
  ToolResult,
  ToolSuccess,
} from "@/lib/tools/types";

export {
  validateAgainstSchema,
  type SchemaValidationFailure,
  type SchemaValidationResult,
  type SchemaValidationSuccess,
} from "@/lib/tools/schema";

export {
  clearToolRegistry,
  getTool,
  hasTool,
  listToolDescriptors,
  listTools,
  registerTool,
  unregisterTool,
} from "@/lib/tools/registry";

export {
  executeTool,
  runTool,
  type ExecuteToolInput,
} from "@/lib/tools/execute";

export {
  DEFAULT_TOOLS,
  registerDefaultTools,
  reregisterDefaultTools,
} from "@/lib/tools/register-defaults";

export {
  listGeminiFunctionDeclarations,
  toolDescriptorToGeminiFunction,
  type GeminiFunctionDeclaration,
} from "@/lib/tools/gemini";

export {
  createTripTool,
  type CreateTripInput,
  type CreateTripOutput,
} from "@/lib/tools/definitions/create-trip";

export {
  updateTripTool,
  type UpdateTripInput,
  type UpdateTripOutput,
} from "@/lib/tools/definitions/update-trip";

export {
  generateItineraryTool,
  type GenerateItineraryInput,
  type GenerateItineraryOutput,
} from "@/lib/tools/definitions/generate-itinerary";

export {
  proposeItineraryEditsTool,
  type ProposeItineraryEditsInput,
  type ProposeItineraryEditsOutput,
} from "@/lib/tools/definitions/propose-itinerary-edits";

export {
  applyItineraryEditsTool,
  type ApplyItineraryEditsInput,
  type ApplyItineraryEditsOutput,
} from "@/lib/tools/definitions/apply-itinerary-edits";

export {
  getCompanionContextTool,
  type GetCompanionContextInput,
  type GetCompanionContextOutput,
} from "@/lib/tools/definitions/get-companion-context";

export {
  getTripMemoryTool,
  updateTripMemoryTool,
  type GetTripMemoryInput,
  type UpdateTripMemoryInput,
} from "@/lib/tools/definitions/trip-memory";

export {
  GUIDE_CATEGORIES,
  queryGuideTool,
  type GuideCategory,
  type QueryGuideInput,
  type QueryGuideOutput,
} from "@/lib/tools/definitions/query-guide";

export {
  documentTools,
  explainDocumentTool,
  findDocumentTool,
  summarizeTicketsTool,
  uploadDocumentTool,
  type ExplainDocumentInput,
  type ExplainDocumentOutput,
  type FindDocumentInput,
  type FindDocumentOutput,
  type SummarizeTicketsInput,
  type SummarizeTicketsOutput,
  type UploadDocumentInput,
  type UploadDocumentOutput,
} from "@/lib/tools/definitions/documents";

export {
  addExpenseTool,
  deleteExpenseTool,
  editExpenseTool,
  expenseTools,
  splitCustomTool,
  splitEquallyTool,
  type AddExpenseInput,
  type DeleteExpenseInput,
  type EditExpenseInput,
  type ExpenseToolOutput,
  type SplitCustomInput,
  type SplitEquallyInput,
} from "@/lib/tools/definitions/expenses";

export {
  assignPayerTool,
  inviteMemberTool,
  memberTools,
  mentionMemberTool,
  removeMemberTool,
  type AssignPayerInput,
  type AssignPayerOutput,
  type InviteMemberInput,
  type InviteMemberOutput,
  type MentionMemberInput,
  type MentionMemberOutput,
  type RemoveMemberInput,
  type RemoveMemberOutput,
} from "@/lib/tools/definitions/members";
