import { assignPayerTool } from "@/lib/tools/definitions/assign-payer";
import { inviteMemberTool } from "@/lib/tools/definitions/invite-member";
import { mentionMemberTool } from "@/lib/tools/definitions/mention-member";
import { removeMemberTool } from "@/lib/tools/definitions/remove-member";
import type { ToolDefinition } from "@/lib/tools/types";

/** Members-domain AI tools (invite, remove, assign payer, mention). */
export const memberTools: ToolDefinition[] = [
  inviteMemberTool as ToolDefinition,
  removeMemberTool as ToolDefinition,
  assignPayerTool as ToolDefinition,
  mentionMemberTool as ToolDefinition,
];

export {
  assignPayerTool,
  type AssignPayerInput,
  type AssignPayerOutput,
} from "@/lib/tools/definitions/assign-payer";
export {
  inviteMemberTool,
  type InviteMemberInput,
  type InviteMemberOutput,
} from "@/lib/tools/definitions/invite-member";
export {
  mentionMemberTool,
  type MentionMemberInput,
  type MentionMemberOutput,
} from "@/lib/tools/definitions/mention-member";
export {
  removeMemberTool,
  type RemoveMemberInput,
  type RemoveMemberOutput,
} from "@/lib/tools/definitions/remove-member";
