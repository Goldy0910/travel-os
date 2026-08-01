import {
  isToolFailure,
  requireMemberToolAuth,
} from "@/lib/tools/members/auth";
import { assignExpensePayer } from "@/lib/tools/members/operations";
import type { ToolDefinition, ToolResult } from "@/lib/tools/types";

export type AssignPayerInput = {
  tripId: string;
  expenseId: string;
  payerUserId: string;
};

export type AssignPayerOutput = {
  expenseId: string;
  payerUserId: string;
  payerDisplayName: string;
  message: string;
};

/**
 * Assign (or reassign) the payer on an existing expense to a trip member.
 * Allowed for expense creator or trip organizer.
 */
export const assignPayerTool: ToolDefinition<
  AssignPayerInput,
  AssignPayerOutput
> = {
  name: "assign_payer",
  description:
    "Set who paid an existing trip expense (paid_by / paid_by_user_id) to a trip member. Creator or organizer only.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["tripId", "expenseId", "payerUserId"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID",
        minLength: 1,
      },
      expenseId: {
        type: "string",
        description: "Expense UUID to update",
        minLength: 1,
      },
      payerUserId: {
        type: "string",
        description: "User id of the trip member who paid",
        minLength: 1,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<AssignPayerOutput>> {
    const auth = await requireMemberToolAuth(input.tripId, ctx);
    if (isToolFailure(auth)) return auth;

    const result = await assignExpensePayer(auth.supabase, {
      tripId: auth.tripId,
      expenseId: input.expenseId,
      payerUserId: input.payerUserId,
      actorUserId: auth.user.id,
    });

    if (!result.ok) {
      return { ok: false, error: result.error, code: result.code };
    }

    return {
      ok: true,
      data: {
        ...result.data,
        message: `Payer set to ${result.data.payerDisplayName}.`,
      },
    };
  },
};
