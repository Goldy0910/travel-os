import {
  groupCommentsByEntityId,
  memberDisplayLabel,
  type MemberLabelRow,
} from "@/lib/trip-entity-comments";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { countTripMembers, isTripMember } from "@/lib/trip-membership";
import { redirect } from "next/navigation";
import type { EntityCommentDTO } from "../_components/entity-comments-block";
import TripExpensesClient, { type ExpenseCardDTO } from "./_components/trip-expenses-client";

type ExpensesPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type TripRecord = Record<string, string | number | null>;
type ExpenseRecord = Record<string, string | number | null>;

function pickFirstString(record: TripRecord, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return fallback;
}

function pickFirstNumber(record: ExpenseRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function formatDate(input: string) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function toDateInput(raw: string) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw).trim());
  return m?.[1] ?? "";
}

function computeMyShare(expense: ExpenseRecord): number {
  const amount = pickFirstNumber(expense, ["amount", "total_amount"]);
  const explicitShare = pickFirstNumber(expense, ["your_share", "share_amount"]);
  if (explicitShare > 0) return explicitShare;

  const splitType = pickFirstString(expense, ["split_type"], "equal").toLowerCase();
  if (splitType === "full") return amount;
  if (splitType === "none") return 0;
  return amount / 2;
}

function expensePaidByCurrentUser(
  expense: ExpenseRecord,
  currentUserLabel: string,
  userId: string,
): boolean {
  const paidBy = pickFirstString(expense, ["paid_by", "payer"], "");
  return paidBy === currentUserLabel || paidBy === userId || paidBy.toLowerCase() === "you";
}

export default async function TripExpensesPage({ params, searchParams }: ExpensesPageProps) {
  const { id: tripId } = await params;
  const query = (await searchParams) ?? {};
  const errorParam = query.error;
  const error =
    typeof errorParam === "string" && errorParam.length > 0
      ? decodeURIComponent(errorParam)
      : "";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) redirect("/app/home");

  const { data: tripData } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();

  if (!tripData) redirect("/app/home");

  const [{ data: expensesData }, { data: expenseCommentsData }, { data: membersForLabels }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .eq("trip_id", tripId)
        .order("date", { ascending: false }),
      supabase
        .from("comments")
        .select("id, trip_id, user_id, entity_type, entity_id, content, created_at")
        .eq("trip_id", tripId)
        .eq("entity_type", "expense"),
      supabase.from("members").select("user_id, name, email").eq("trip_id", tripId),
    ]);

  const expenses = (expensesData ?? []) as ExpenseRecord[];
  const expenseCommentsById = groupCommentsByEntityId(
    (expenseCommentsData ?? []) as EntityCommentDTO[],
  );

  const memberLabelByUserId: Record<string, string> = {};
  for (const row of membersForLabels ?? []) {
    const m = row as MemberLabelRow;
    if (m.user_id) {
      memberLabelByUserId[m.user_id] = memberDisplayLabel(m);
    }
  }
  const metaName = user.user_metadata?.full_name;
  if (!memberLabelByUserId[user.id]) {
    memberLabelByUserId[user.id] =
      (typeof metaName === "string" && metaName.trim()) ||
      user.email?.split("@")[0] ||
      "You";
  }
  const currentUserLabel = user.email ?? user.id;
  const defaultPaidBy = currentUserLabel;
  const memberCount = await countTripMembers(supabase, tripId);

  const totalSpent = expenses.reduce(
    (sum, expense) => sum + pickFirstNumber(expense, ["amount", "total_amount"]),
    0,
  );

  const yourShareTotal = expenses.reduce((sum, expense) => sum + computeMyShare(expense), 0);

  const netBalance = expenses.reduce((sum, expense) => {
    const amount = pickFirstNumber(expense, ["amount", "total_amount"]);
    const explicitShare = pickFirstNumber(expense, ["your_share", "share_amount"]);
    const splitType = pickFirstString(expense, ["split_type"], "equal").toLowerCase();
    const paidBy = pickFirstString(expense, ["paid_by", "payer"], "unknown");
    const isPaidByYou =
      paidBy === currentUserLabel || paidBy === user.id || paidBy.toLowerCase() === "you";

    const share =
      explicitShare > 0
        ? explicitShare
        : splitType === "full"
          ? amount
          : splitType === "none"
            ? 0
            : amount / 2;

    if (isPaidByYou) return sum + (amount - share);
    return sum - share;
  }, 0);

  const expenseRows: ExpenseCardDTO[] = expenses
    .map((expense, index) => {
      const expenseId =
        expense.id != null && expense.id !== "" ? String(expense.id) : null;
      if (!expenseId) return null;

      const title = pickFirstString(expense, ["title", "name"], `Expense ${index + 1}`);
      const amount = pickFirstNumber(expense, ["amount", "total_amount"]);
      const paidBy = pickFirstString(expense, ["paid_by", "payer"], "Unknown");
      const splitTypeRaw = pickFirstString(expense, ["split_type"], "equal");
      const dateRaw = pickFirstString(expense, ["date", "expense_date", "created_at"], "");
      const dateLabel = dateRaw ? formatDate(dateRaw) : "";
      const dateInput = toDateInput(dateRaw);

      return {
        id: expenseId,
        title,
        amount,
        paidBy,
        splitTypeRaw,
        dateLabel,
        dateInput,
        myShare: computeMyShare(expense),
        isPaidByYou: expensePaidByCurrentUser(expense, currentUserLabel, user.id),
      };
    })
    .filter((row): row is ExpenseCardDTO => row != null);

  const tripTitle = pickFirstString(
    tripData as TripRecord,
    ["title", "name", "trip_name"],
    "Trip expenses",
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-28">
      <div className="mx-auto w-full max-w-md space-y-5">
        <TripExpensesClient
          tripId={tripId}
          tripTitle={tripTitle}
          defaultPaidBy={defaultPaidBy}
          memberCount={memberCount}
          totalSpent={totalSpent}
          yourShareTotal={yourShareTotal}
          netBalance={netBalance}
          expenses={expenseRows}
          initialError={error}
          currentUserId={user.id}
          memberLabelByUserId={memberLabelByUserId}
          expenseCommentsById={expenseCommentsById}
        />
      </div>
    </main>
  );
}
