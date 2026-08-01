import {
  isToolFailure,
  requireMemberToolAuth,
} from "@/lib/tools/members/auth";
import { removeTripMember } from "@/lib/tools/members/operations";
import type { ToolDefinition, ToolResult } from "@/lib/tools/types";

export type RemoveMemberInput = {
  tripId: string;
  memberId?: string;
  userId?: string;
  email?: string;
};

export type RemoveMemberOutput = {
  removedMemberId: string;
  removedUserId: string | null;
  message: string;
};

/**
 * Remove a trip member (or pending invite). Organizer-only.
 * Mirrors deleteMemberAction rules (including last-organizer protection).
 */
export const removeMemberTool: ToolDefinition<
  RemoveMemberInput,
  RemoveMemberOutput
> = {
  name: "remove_member",
  description:
    "Remove a member or pending invite from a trip by memberId, userId, or email. Organizer only; cannot remove the last organizer.",
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
      memberId: {
        type: "string",
        description: "members table row id",
      },
      userId: {
        type: "string",
        description: "Auth user id of the member to remove",
      },
      email: {
        type: "string",
        description: "Email for pending invites (user_id is null)",
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<RemoveMemberOutput>> {
    const auth = await requireMemberToolAuth(input.tripId, ctx, {
      organizerOnly: true,
    });
    if (isToolFailure(auth)) return auth;

    if (!input.memberId && !input.userId && !input.email) {
      return {
        ok: false,
        error: "Provide memberId, userId, or email",
        code: "INVALID_INPUT",
      };
    }

    const result = await removeTripMember(auth.supabase, {
      tripId: auth.tripId,
      memberId: input.memberId,
      userId: input.userId,
      email: input.email,
    });

    if (!result.ok) {
      return { ok: false, error: result.error, code: result.code };
    }

    return {
      ok: true,
      data: {
        ...result.data,
        message: "Member removed.",
      },
    };
  },
};
