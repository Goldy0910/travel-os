import {
  isToolFailure,
  requireMemberToolAuth,
} from "@/lib/tools/members/auth";
import {
  resolveMemberMention,
  type MemberMentionPayload,
} from "@/lib/tools/members/operations";
import type { ToolDefinition, ToolResult } from "@/lib/tools/types";

export type MentionMemberInput = {
  tripId: string;
  userId?: string;
  query?: string;
};

export type MentionMemberOutput = MemberMentionPayload & {
  matches?: MemberMentionPayload[];
};

/**
 * Resolve a trip member into a structured mention payload for chat/AI use.
 * Does not invent UI — returns userId + displayName (+ mentionText).
 */
export const mentionMemberTool: ToolDefinition<
  MentionMemberInput,
  MentionMemberOutput
> = {
  name: "mention_member",
  description:
    "Resolve a trip member by userId or name/email query into a structured mention payload (userId, displayName, mentionText) for chat or AI replies.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["tripId"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID",
        minLength: 1,
      },
      userId: {
        type: "string",
        description: "Exact auth user id of the member",
      },
      query: {
        type: "string",
        description: "Name or email fragment to match against trip members",
        minLength: 1,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<MentionMemberOutput>> {
    const auth = await requireMemberToolAuth(input.tripId, ctx);
    if (isToolFailure(auth)) return auth;

    if (!input.userId && !input.query) {
      return {
        ok: false,
        error: "Provide userId or query",
        code: "INVALID_INPUT",
      };
    }

    const result = await resolveMemberMention(auth.supabase, {
      tripId: auth.tripId,
      userId: input.userId,
      query: input.query,
    });

    if (!result.ok) {
      return { ok: false, error: result.error, code: result.code };
    }

    return { ok: true, data: result.data };
  },
};
