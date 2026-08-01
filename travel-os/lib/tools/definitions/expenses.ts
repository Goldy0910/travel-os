import type { User } from "@supabase/supabase-js";
import type { SplitType } from "@/app/app/trip/[id]/expenses/_lib/expense-split";
import {
  deleteExpenseMutation,
  listTripMemberUserIds,
  loadExpenseForMutation,
  saveExpenseMutation,
  type ExpenseMutationResult,
} from "@/lib/expenses/mutations";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ToolContext, ToolDefinition, ToolResult } from "@/lib/tools/types";

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sharesToMaps(
  shares: Array<{ userId: string; amount?: number; percentage?: number }> | undefined,
): {
  participantIds: string[];
  exactAmountsByUserId: Record<string, number>;
  percentagesByUserId: Record<string, number>;
} {
  const participantIds: string[] = [];
  const exactAmountsByUserId: Record<string, number> = {};
  const percentagesByUserId: Record<string, number> = {};
  const seen = new Set<string>();
  for (const share of shares ?? []) {
    const userId = String(share.userId ?? "").trim();
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    participantIds.push(userId);
    if (share.amount != null && Number.isFinite(share.amount)) {
      exactAmountsByUserId[userId] = Number(share.amount);
    }
    if (share.percentage != null && Number.isFinite(share.percentage)) {
      percentagesByUserId[userId] = Number(share.percentage);
    }
  }
  return { participantIds, exactAmountsByUserId, percentagesByUserId };
}

async function resolveToolUser(
  ctx: ToolContext,
): Promise<ToolResult<{ supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; user: User }>> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        ok: false,
        error: "Authentication required to manage expenses.",
        code: "UNAUTHORIZED",
      };
    }
    if (ctx.userId && ctx.userId !== user.id) {
      return {
        ok: false,
        error: "Authenticated user does not match tool context userId.",
        code: "UNAUTHORIZED",
      };
    }
    return { ok: true, data: { supabase, user } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create server client";
    return { ok: false, error: message, code: "HANDLER_ERROR" };
  }
}

function resolveTripId(explicit: string | undefined, ctx: ToolContext): string {
  return (explicit?.trim() || ctx.tripId?.trim() || "").trim();
}

function mutationToToolResult(
  result: ExpenseMutationResult,
): ToolResult<{
  expenseId: string;
  message: string;
  splitType: SplitType;
  participantCount: number;
}> {
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      code: result.code ?? "HANDLER_ERROR",
    };
  }
  return {
    ok: true,
    data: {
      expenseId: result.expenseId,
      message: result.message,
      splitType: result.splitType,
      participantCount: result.participantCount,
    },
  };
}

const shareItemSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["userId"],
  properties: {
    userId: {
      type: "string" as const,
      description: "Trip member user UUID",
      minLength: 1,
    },
    amount: {
      type: "number" as const,
      description: "Exact share amount (for exact / custom amount splits)",
      minimum: 0,
    },
    percentage: {
      type: "number" as const,
      description: "Share percentage 0–100 (for percentage splits)",
      minimum: 0,
      maximum: 100,
    },
  },
};

export type AddExpenseInput = {
  tripId?: string;
  title?: string;
  description?: string;
  amount: number;
  paidByUserId?: string;
  date?: string;
  splitType?: SplitType;
  includePayerInEqual?: boolean;
  participantIds?: string[];
  shares?: Array<{ userId: string; amount?: number; percentage?: number }>;
};

export type EditExpenseInput = {
  tripId?: string;
  expenseId: string;
  title?: string;
  description?: string;
  amount?: number;
  paidByUserId?: string;
  date?: string;
  splitType?: SplitType;
  includePayerInEqual?: boolean;
  participantIds?: string[];
  shares?: Array<{ userId: string; amount?: number; percentage?: number }>;
};

export type DeleteExpenseInput = {
  tripId?: string;
  expenseId: string;
};

export type SplitEquallyInput = {
  tripId?: string;
  expenseId: string;
  participantIds?: string[];
  includePayerInEqual?: boolean;
};

export type SplitCustomInput = {
  tripId?: string;
  expenseId: string;
  mode: "exact" | "percentage";
  shares: Array<{ userId: string; amount?: number; percentage?: number }>;
};

export type ExpenseToolOutput = {
  expenseId: string;
  message: string;
  splitType: SplitType;
  participantCount: number;
};

export const addExpenseTool: ToolDefinition<AddExpenseInput, ExpenseToolOutput> = {
  name: "add_expense",
  description:
    "Add a trip expense with amount, payer, date, and split (equal, exact, percentage, or none). Defaults to equal split among all trip members when participants are omitted.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["amount"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId)",
        minLength: 1,
      },
      title: { type: "string", description: "Expense title" },
      description: { type: "string", description: "Optional notes" },
      amount: {
        type: "number",
        description: "Total expense amount",
        minimum: 0.01,
      },
      paidByUserId: {
        type: "string",
        description: "User UUID of who paid (defaults to the authenticated user)",
      },
      date: {
        type: "string",
        description: "Expense date YYYY-MM-DD (defaults to today)",
        minLength: 10,
        maxLength: 10,
      },
      splitType: {
        type: "string",
        description: "How to split the expense",
        enum: ["equal", "exact", "percentage", "none"],
        default: "equal",
      },
      includePayerInEqual: {
        type: "boolean",
        description: "For equal splits, whether the payer is included in the split",
        default: true,
      },
      participantIds: {
        type: "array",
        description: "Member user UUIDs in the split (defaults to all trip members)",
        items: { type: "string", minLength: 1 },
      },
      shares: {
        type: "array",
        description: "Optional per-member amounts/percentages for exact or percentage splits",
        items: shareItemSchema,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<ExpenseToolOutput>> {
    const auth = await resolveToolUser(ctx);
    if (!auth.ok) return auth;
    const { supabase, user } = auth.data;

    const tripId = resolveTripId(input.tripId, ctx);
    if (!tripId) {
      return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
    }

    const splitType = (input.splitType ?? "equal") as SplitType;
    const fromShares = sharesToMaps(input.shares);
    let participantIds =
      input.participantIds && input.participantIds.length > 0
        ? input.participantIds.map(String)
        : fromShares.participantIds;

    if (participantIds.length === 0 && splitType !== "none") {
      participantIds = await listTripMemberUserIds(supabase, tripId);
    }

    const result = await saveExpenseMutation(supabase, {
      tripId,
      user,
      title: input.title,
      description: input.description,
      amount: input.amount,
      paidByUserId: input.paidByUserId?.trim() || user.id,
      splitType,
      date: input.date?.trim() || todayYmd(),
      includePayerInEqual: input.includePayerInEqual !== false,
      participantIds,
      exactAmountsByUserId: fromShares.exactAmountsByUserId,
      percentagesByUserId: fromShares.percentagesByUserId,
    });
    return mutationToToolResult(result);
  },
};

export const editExpenseTool: ToolDefinition<EditExpenseInput, ExpenseToolOutput> = {
  name: "edit_expense",
  description:
    "Edit an existing trip expense. Omitted fields keep their current values. Optionally update split type and participant shares.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["expenseId"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId)",
        minLength: 1,
      },
      expenseId: {
        type: "string",
        description: "Expense UUID to update",
        minLength: 1,
      },
      title: { type: "string", description: "New expense title" },
      description: { type: "string", description: "New notes" },
      amount: {
        type: "number",
        description: "New total amount",
        minimum: 0.01,
      },
      paidByUserId: {
        type: "string",
        description: "New payer user UUID",
      },
      date: {
        type: "string",
        description: "New expense date YYYY-MM-DD",
        minLength: 10,
        maxLength: 10,
      },
      splitType: {
        type: "string",
        description: "New split mode",
        enum: ["equal", "exact", "percentage", "none"],
      },
      includePayerInEqual: {
        type: "boolean",
        description: "For equal splits, whether the payer is included",
        default: true,
      },
      participantIds: {
        type: "array",
        description: "Replacement participant user UUIDs",
        items: { type: "string", minLength: 1 },
      },
      shares: {
        type: "array",
        description: "Replacement per-member amounts/percentages",
        items: shareItemSchema,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<ExpenseToolOutput>> {
    const auth = await resolveToolUser(ctx);
    if (!auth.ok) return auth;
    const { supabase, user } = auth.data;

    const tripId = resolveTripId(input.tripId, ctx);
    if (!tripId) {
      return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
    }

    const loaded = await loadExpenseForMutation(supabase, tripId, input.expenseId);
    if (!loaded.ok) {
      return { ok: false, error: loaded.error, code: loaded.code ?? "HANDLER_ERROR" };
    }
    const existing = loaded.expense;
    const fromShares = sharesToMaps(input.shares);
    const hasShares = (input.shares?.length ?? 0) > 0;
    const hasParticipants = (input.participantIds?.length ?? 0) > 0;

    const splitType = (input.splitType ?? existing.splitType) as SplitType;
    const participantIds = hasParticipants
      ? input.participantIds!.map(String)
      : hasShares
        ? fromShares.participantIds
        : existing.participantIds;

    const result = await saveExpenseMutation(supabase, {
      tripId,
      user,
      expenseId: existing.id,
      title: input.title ?? existing.title,
      description:
        input.description !== undefined ? input.description : existing.description,
      amount: input.amount ?? existing.amount,
      paidByUserId: input.paidByUserId?.trim() || existing.paidByUserId || user.id,
      splitType,
      date: input.date?.trim() || existing.date || todayYmd(),
      includePayerInEqual: input.includePayerInEqual !== false,
      participantIds,
      exactAmountsByUserId: hasShares
        ? fromShares.exactAmountsByUserId
        : existing.exactAmountsByUserId,
      percentagesByUserId: hasShares
        ? fromShares.percentagesByUserId
        : existing.percentagesByUserId,
    });
    return mutationToToolResult(result);
  },
};

export const deleteExpenseTool: ToolDefinition<DeleteExpenseInput, ExpenseToolOutput> = {
  name: "delete_expense",
  description:
    "Delete a trip expense. Allowed for the expense creator or a trip organiser.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["expenseId"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId)",
        minLength: 1,
      },
      expenseId: {
        type: "string",
        description: "Expense UUID to delete",
        minLength: 1,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<ExpenseToolOutput>> {
    const auth = await resolveToolUser(ctx);
    if (!auth.ok) return auth;
    const { supabase, user } = auth.data;

    const tripId = resolveTripId(input.tripId, ctx);
    if (!tripId) {
      return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
    }

    const result = await deleteExpenseMutation(supabase, {
      tripId,
      userId: user.id,
      expenseId: input.expenseId,
    });
    return mutationToToolResult(result);
  },
};

export const splitEquallyTool: ToolDefinition<SplitEquallyInput, ExpenseToolOutput> = {
  name: "split_equally",
  description:
    "Re-split an existing expense equally among the given participants (or all current participants / trip members).",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["expenseId"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId)",
        minLength: 1,
      },
      expenseId: {
        type: "string",
        description: "Expense UUID to re-split",
        minLength: 1,
      },
      participantIds: {
        type: "array",
        description: "Member user UUIDs to include (defaults to current participants, else all members)",
        items: { type: "string", minLength: 1 },
      },
      includePayerInEqual: {
        type: "boolean",
        description: "Whether the payer is included in the equal split",
        default: true,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<ExpenseToolOutput>> {
    const auth = await resolveToolUser(ctx);
    if (!auth.ok) return auth;
    const { supabase, user } = auth.data;

    const tripId = resolveTripId(input.tripId, ctx);
    if (!tripId) {
      return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
    }

    const loaded = await loadExpenseForMutation(supabase, tripId, input.expenseId);
    if (!loaded.ok) {
      return { ok: false, error: loaded.error, code: loaded.code ?? "HANDLER_ERROR" };
    }
    const existing = loaded.expense;

    let participantIds =
      input.participantIds && input.participantIds.length > 0
        ? input.participantIds.map(String)
        : existing.participantIds;
    if (participantIds.length === 0) {
      participantIds = await listTripMemberUserIds(supabase, tripId);
    }

    const result = await saveExpenseMutation(supabase, {
      tripId,
      user,
      expenseId: existing.id,
      title: existing.title,
      description: existing.description,
      amount: existing.amount,
      paidByUserId: existing.paidByUserId || user.id,
      splitType: "equal",
      date: existing.date || todayYmd(),
      includePayerInEqual: input.includePayerInEqual !== false,
      participantIds,
    });
    return mutationToToolResult(result);
  },
};

export const splitCustomTool: ToolDefinition<SplitCustomInput, ExpenseToolOutput> = {
  name: "split_custom",
  description:
    "Re-split an existing expense with custom exact amounts or percentages per participant. Shares must cover the participants in the split.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["expenseId", "mode", "shares"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId)",
        minLength: 1,
      },
      expenseId: {
        type: "string",
        description: "Expense UUID to re-split",
        minLength: 1,
      },
      mode: {
        type: "string",
        description: "Custom split mode: exact amounts or percentages",
        enum: ["exact", "percentage"],
      },
      shares: {
        type: "array",
        description:
          "Per-member shares. Use amount for mode=exact (must sum to expense total) or percentage for mode=percentage (must sum to 100).",
        items: shareItemSchema,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<ExpenseToolOutput>> {
    const auth = await resolveToolUser(ctx);
    if (!auth.ok) return auth;
    const { supabase, user } = auth.data;

    const tripId = resolveTripId(input.tripId, ctx);
    if (!tripId) {
      return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
    }
    if (!input.shares?.length) {
      return { ok: false, error: "shares must include at least one participant", code: "INVALID_INPUT" };
    }

    const loaded = await loadExpenseForMutation(supabase, tripId, input.expenseId);
    if (!loaded.ok) {
      return { ok: false, error: loaded.error, code: loaded.code ?? "HANDLER_ERROR" };
    }
    const existing = loaded.expense;
    const fromShares = sharesToMaps(input.shares);

    if (input.mode === "exact") {
      for (const id of fromShares.participantIds) {
        if (!(id in fromShares.exactAmountsByUserId)) {
          return {
            ok: false,
            error: `Missing amount for participant ${id}`,
            code: "INVALID_INPUT",
          };
        }
      }
    } else {
      for (const id of fromShares.participantIds) {
        if (!(id in fromShares.percentagesByUserId)) {
          return {
            ok: false,
            error: `Missing percentage for participant ${id}`,
            code: "INVALID_INPUT",
          };
        }
      }
    }

    const result = await saveExpenseMutation(supabase, {
      tripId,
      user,
      expenseId: existing.id,
      title: existing.title,
      description: existing.description,
      amount: existing.amount,
      paidByUserId: existing.paidByUserId || user.id,
      splitType: input.mode === "percentage" ? "percentage" : "exact",
      date: existing.date || todayYmd(),
      participantIds: fromShares.participantIds,
      exactAmountsByUserId: fromShares.exactAmountsByUserId,
      percentagesByUserId: fromShares.percentagesByUserId,
    });
    return mutationToToolResult(result);
  },
};

/** All expense AI tools for registry registration. */
export const expenseTools: Array<ToolDefinition<any, any>> = [
  addExpenseTool,
  editExpenseTool,
  deleteExpenseTool,
  splitEquallyTool,
  splitCustomTool,
];
