import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  actorDisplayName,
  formatExpenseAddedAction,
  insertTripActivityLog,
} from "@/lib/activity-log";
import { getMemberRole, isTripMember } from "@/lib/trip-membership";
import {
  computeExpenseSplit,
  type SplitType,
} from "@/app/app/trip/[id]/expenses/_lib/expense-split";
import { revalidatePath } from "next/cache";

export type ExpenseMutationSuccess = {
  ok: true;
  expenseId: string;
  message: string;
  splitType: SplitType;
  participantCount: number;
};

export type ExpenseMutationFailure = {
  ok: false;
  error: string;
  code?:
    | "UNAUTHORIZED"
    | "NOT_MEMBER"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "INVALID_INPUT"
    | "DB_ERROR";
};

export type ExpenseMutationResult = ExpenseMutationSuccess | ExpenseMutationFailure;

export type SaveExpenseParams = {
  tripId: string;
  user: User;
  expenseId?: string | null;
  title?: string | null;
  description?: string | null;
  amount: number;
  paidByUserId: string;
  splitType: SplitType;
  date: string;
  includePayerInEqual?: boolean;
  participantIds: string[];
  exactAmountsByUserId?: Record<string, number>;
  percentagesByUserId?: Record<string, number>;
  /** When false, skip Next.js path revalidation (e.g. batch callers). Default true. */
  revalidate?: boolean;
};

export type DeleteExpenseParams = {
  tripId: string;
  userId: string;
  expenseId: string;
  revalidate?: boolean;
};

async function canMutateExpense(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  expenseUserId: string | null,
): Promise<boolean> {
  const role = await getMemberRole(supabase, tripId, userId);
  if (role === "organizer") return true;
  if (expenseUserId != null && expenseUserId === userId) return true;
  return false;
}

function revalidateExpensePaths(tripId: string) {
  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath(`/app/trip/${tripId}/expenses`);
  revalidatePath("/app/home");
}

export async function listTripMemberUserIds(
  supabase: SupabaseClient,
  tripId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("members")
    .select("user_id")
    .eq("trip_id", tripId);

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const id = row.user_id != null ? String(row.user_id).trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export type LoadedExpense = {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  paidByUserId: string;
  splitType: SplitType;
  date: string;
  creatorUserId: string | null;
  participantIds: string[];
  exactAmountsByUserId: Record<string, number>;
  percentagesByUserId: Record<string, number>;
};

export async function loadExpenseForMutation(
  supabase: SupabaseClient,
  tripId: string,
  expenseId: string,
): Promise<{ ok: true; expense: LoadedExpense } | ExpenseMutationFailure> {
  const { data: row, error } = await supabase
    .from("expenses")
    .select(
      "id, title, description, amount, total_amount, paid_by, paid_by_user_id, payer, split_type, date, user_id",
    )
    .eq("id", expenseId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message || "Could not load expense.", code: "DB_ERROR" };
  }
  if (!row?.id) {
    return { ok: false, error: "Expense not found.", code: "NOT_FOUND" };
  }

  const amountRaw = Number(row.amount ?? row.total_amount ?? 0);
  const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
  const paidByUserId = String(
    row.paid_by_user_id ?? row.paid_by ?? row.payer ?? "",
  ).trim();
  const splitRaw = String(row.split_type ?? "equal").trim().toLowerCase();
  const splitType: SplitType = (
    ["equal", "exact", "percentage", "none"].includes(splitRaw)
      ? splitRaw
      : "equal"
  ) as SplitType;

  const { data: participants } = await supabase
    .from("expense_participants")
    .select("user_id, split_value, split_type, computed_amount")
    .eq("expense_id", expenseId);

  const participantIds: string[] = [];
  const exactAmountsByUserId: Record<string, number> = {};
  const percentagesByUserId: Record<string, number> = {};
  const seen = new Set<string>();

  for (const p of participants ?? []) {
    const userId = p.user_id != null ? String(p.user_id).trim() : "";
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    participantIds.push(userId);
    const splitValue = Number(p.split_value ?? 0);
    const computed = Number(p.computed_amount ?? 0);
    const pSplit = String(p.split_type ?? "").toLowerCase();
    if (pSplit === "percentage") {
      percentagesByUserId[userId] = Number.isFinite(splitValue) ? splitValue : 0;
    } else {
      exactAmountsByUserId[userId] = Number.isFinite(computed)
        ? computed
        : Number.isFinite(splitValue)
          ? splitValue
          : 0;
    }
  }

  return {
    ok: true,
    expense: {
      id: String(row.id),
      title: String(row.title ?? "").trim() || "Expense",
      description:
        row.description != null && String(row.description).trim()
          ? String(row.description).trim()
          : null,
      amount,
      paidByUserId,
      splitType,
      date: String(row.date ?? "").trim(),
      creatorUserId:
        row.user_id != null && String(row.user_id).length > 0
          ? String(row.user_id)
          : null,
      participantIds,
      exactAmountsByUserId,
      percentagesByUserId,
    },
  };
}

/**
 * Persist an expense insert/update using the same rules as the Expenses UI
 * (`saveExpenseAction` / `computeExpenseSplit` + `expense_participants`).
 */
export async function saveExpenseMutation(
  supabase: SupabaseClient,
  params: SaveExpenseParams,
): Promise<ExpenseMutationResult> {
  const tripId = params.tripId.trim();
  const userId = params.user.id;
  const expenseIdRaw = params.expenseId?.trim() || "";
  const amount = Number(params.amount);
  const paidBy = params.paidByUserId.trim();
  const splitType = params.splitType;
  const date = params.date.trim();
  const title = (params.title ?? "").trim();
  const description = (params.description ?? "").trim();

  if (!(amount > 0) || !paidBy || !splitType || !date) {
    return {
      ok: false,
      error: "Please fill all fields correctly.",
      code: "INVALID_INPUT",
    };
  }
  if (!["equal", "exact", "percentage", "none"].includes(splitType)) {
    return { ok: false, error: "Invalid split type.", code: "INVALID_INPUT" };
  }

  const member = await isTripMember(supabase, tripId, userId);
  if (!member) {
    return { ok: false, error: "You are not a member of this trip.", code: "NOT_MEMBER" };
  }

  const split = computeExpenseSplit({
    amount,
    splitType,
    paidByUserId: paidBy,
    selectedParticipantIds: params.participantIds,
    includePayerInEqual: params.includePayerInEqual !== false,
    exactAmountsByUserId: params.exactAmountsByUserId ?? {},
    percentagesByUserId: params.percentagesByUserId ?? {},
  });
  if (split.errors.length > 0) {
    return {
      ok: false,
      error: split.errors[0] ?? "Invalid split values.",
      code: "INVALID_INPUT",
    };
  }

  const payload = {
    title: title || description || "Expense",
    description: description || null,
    amount,
    paid_by: paidBy,
    paid_by_user_id: paidBy,
    split_type: splitType,
    date,
    total_amount: amount,
    payer: paidBy,
    created_by: userId,
  };

  const participantRows = split.rows.map((row) => ({
    user_id: row.userId,
    split_value: row.splitValue,
    split_type: row.splitType,
    computed_amount: row.computedAmount,
    owes_amount: row.owesAmount,
  }));

  if (expenseIdRaw) {
    const { data: existing } = await supabase
      .from("expenses")
      .select("user_id")
      .eq("id", expenseIdRaw)
      .eq("trip_id", tripId)
      .maybeSingle();

    if (!existing) {
      return { ok: false, error: "Expense not found.", code: "NOT_FOUND" };
    }

    const creatorId =
      existing.user_id != null && String(existing.user_id).length > 0
        ? String(existing.user_id)
        : null;
    if (!(await canMutateExpense(supabase, tripId, userId, creatorId))) {
      return {
        ok: false,
        error: "Only the person who added this expense or an organiser can edit it.",
        code: "FORBIDDEN",
      };
    }

    const { error } = await supabase
      .from("expenses")
      .update(payload)
      .eq("id", expenseIdRaw)
      .eq("trip_id", tripId);

    if (error) {
      return {
        ok: false,
        error: error.message || "Could not update expense.",
        code: "DB_ERROR",
      };
    }

    await supabase.from("expense_participants").delete().eq("expense_id", expenseIdRaw);
    if (participantRows.length > 0) {
      const { error: participantsError } = await supabase
        .from("expense_participants")
        .insert(
          participantRows.map((row) => ({
            expense_id: expenseIdRaw,
            ...row,
          })),
        );
      if (participantsError) {
        return {
          ok: false,
          error: participantsError.message || "Could not update split details.",
          code: "DB_ERROR",
        };
      }
    }

    if (params.revalidate !== false) revalidateExpensePaths(tripId);
    return {
      ok: true,
      expenseId: expenseIdRaw,
      message: "Expense updated.",
      splitType,
      participantCount: participantRows.length,
    };
  }

  const { data: insertedExpense, error: insertError } = await supabase
    .from("expenses")
    .insert({
      ...payload,
      trip_id: tripId,
      user_id: userId,
    })
    .select("id")
    .single();

  if (insertError || !insertedExpense?.id) {
    return {
      ok: false,
      error: insertError?.message || "Could not add expense.",
      code: "DB_ERROR",
    };
  }

  const newId = String(insertedExpense.id);
  if (participantRows.length > 0) {
    const { error: participantsError } = await supabase
      .from("expense_participants")
      .insert(
        participantRows.map((row) => ({
          expense_id: newId,
          ...row,
        })),
      );
    if (participantsError) {
      return {
        ok: false,
        error: participantsError.message || "Could not save split details.",
        code: "DB_ERROR",
      };
    }
  }

  await insertTripActivityLog(supabase, {
    tripId,
    userId,
    action: formatExpenseAddedAction(
      actorDisplayName(params.user),
      title || description || "Expense",
    ),
  });

  if (params.revalidate !== false) revalidateExpensePaths(tripId);
  return {
    ok: true,
    expenseId: newId,
    message: "Expense added.",
    splitType,
    participantCount: participantRows.length,
  };
}

export async function deleteExpenseMutation(
  supabase: SupabaseClient,
  params: DeleteExpenseParams,
): Promise<ExpenseMutationResult> {
  const tripId = params.tripId.trim();
  const expenseId = params.expenseId.trim();
  const userId = params.userId;

  const member = await isTripMember(supabase, tripId, userId);
  if (!member) {
    return { ok: false, error: "You are not a member of this trip.", code: "NOT_MEMBER" };
  }

  const { data: existing } = await supabase
    .from("expenses")
    .select("user_id")
    .eq("id", expenseId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Expense not found.", code: "NOT_FOUND" };
  }

  const creatorId =
    existing.user_id != null && String(existing.user_id).length > 0
      ? String(existing.user_id)
      : null;
  if (!(await canMutateExpense(supabase, tripId, userId, creatorId))) {
    return {
      ok: false,
      error: "Only the person who added this expense or an organiser can delete it.",
      code: "FORBIDDEN",
    };
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("trip_id", tripId);

  if (error) {
    return {
      ok: false,
      error: error.message || "Could not delete expense.",
      code: "DB_ERROR",
    };
  }

  if (params.revalidate !== false) revalidateExpensePaths(tripId);
  return {
    ok: true,
    expenseId,
    message: "Expense deleted.",
    splitType: "none",
    participantCount: 0,
  };
}
