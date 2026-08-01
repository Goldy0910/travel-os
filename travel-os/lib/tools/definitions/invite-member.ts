import {
  isToolFailure,
  requireMemberToolAuth,
} from "@/lib/tools/members/auth";
import { inviteTripMember } from "@/lib/tools/members/operations";
import type { ToolDefinition, ToolResult } from "@/lib/tools/types";

export type InviteMemberInput = {
  tripId: string;
  email?: string;
  name?: string;
};

export type InviteMemberOutput = {
  joinUrl: string;
  inviteCode: string;
  hasInviteCode: boolean;
  pendingInvite: null | {
    memberId: string;
    email: string;
    name: string;
    role: string;
  };
  message: string;
};

/**
 * Invite someone to a trip via pending email membership and/or shareable invite link.
 * Organizer-only. Reuses members insert + trips.invite_code paths.
 */
export const inviteMemberTool: ToolDefinition<
  InviteMemberInput,
  InviteMemberOutput
> = {
  name: "invite_member",
  description:
    "Invite a person to a trip. Optionally create a pending email invite; always returns the trip join/invite link. Organizer only.",
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
      email: {
        type: "string",
        description:
          "Optional email for a pending members row (links when they sign up)",
        minLength: 3,
      },
      name: {
        type: "string",
        description: "Optional display name for the pending invite",
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<InviteMemberOutput>> {
    const auth = await requireMemberToolAuth(input.tripId, ctx, {
      organizerOnly: true,
    });
    if (isToolFailure(auth)) return auth;

    const result = await inviteTripMember(auth.supabase, {
      tripId: auth.tripId,
      email: input.email,
      name: input.name,
    });

    if (!result.ok) {
      return { ok: false, error: result.error, code: result.code };
    }

    const message = result.data.pendingInvite
      ? `Pending invite created for ${result.data.pendingInvite.email}. Share the join link to onboard them.`
      : "Share the join link to invite members to this trip.";

    return {
      ok: true,
      data: {
        ...result.data,
        message,
      },
    };
  },
};
