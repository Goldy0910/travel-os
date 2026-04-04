import {
  groupCommentsByEntityId,
  memberDisplayLabel,
  type MemberLabelRow,
} from "@/lib/trip-entity-comments";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { countTripMembers, getMemberRole, isTripMember } from "@/lib/trip-membership";
import { redirect } from "next/navigation";
import type { EntityCommentDTO } from "../_components/entity-comments-block";
import TripExpensesClient, {
  type ExpenseCardDTO,
  type PaidByMemberOption,
} from "./_components/trip-expenses-client";

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

function paidByIsCurrentUser(
  paidBy: string,
  userId: string,
  userEmail: string | undefined,
  displayLabel: string,
): boolean {
  const trimmed = paidBy.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "you") return true;
  if (trimmed === userId) return true;
  if (userEmail && trimmed === userEmail) return true;
  if (trimmed === displayLabel) return true;
  if (displayLabel.length > 0 && lower === displayLabel.toLowerCase()) return true;
  return false;
}

function expensePaidByCurrentUser(
  expense: ExpenseRecord,
  userId: string,
  userEmail: string | undefined,
  displayLabel: string,
): boolean {
  const paidBy = pickFirstString(expense, ["paid_by", "payer"], "");
  return paidByIsCurrentUser(paidBy, userId, userEmail, displayLabel);
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

  const memberRole = await getMemberRole(supabase, tripId, user.id);
  const isOrganizer = memberRole === "organizer";

  const { data: tripData } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();

  if (!tripData) redirect("/app/home");

  const [
    { data: expensesData },
    { data: expenseCommentsData },
    { data: membersForLabels },
    profileRes,
  ] = await Promise.all([
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
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
  ]);

  const profileRow = profileRes.error ? null : profileRes.data;

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
  const profileNameFromDb =
    profileRow && typeof profileRow.name === "string" && profileRow.name.trim().length > 0
      ? profileRow.name.trim()
      : null;
  const profileName =
    profileNameFromDb ||
    (typeof metaName === "string" && metaName.trim().length > 0 ? metaName.trim() : null);
  if (profileName) {
    memberLabelByUserId[user.id] = profileName;
  } else if (!memberLabelByUserId[user.id]) {
    memberLabelByUserId[user.id] =
      (typeof metaName === "string" && metaName.trim()) ||
      user.email?.split("@")[0] ||
      "You";
  }
  const currentUserDisplayLabel = memberLabelByUserId[user.id] ?? user.email ?? user.id;

  const paidByMemberOptions: PaidByMemberOption[] = [];
  const optionUserIds = new Set<string>();
  for (const row of membersForLabels ?? []) {
    const m = row as MemberLabelRow;
    if (!m.user_id) continue;
    const uid = String(m.user_id);
    if (optionUserIds.has(uid)) continue;
    optionUserIds.add(uid);
    paidByMemberOptions.push({
      userId: uid,
      label: memberLabelByUserId[uid] ?? memberDisplayLabel(m),
      email: typeof m.email === "string" ? m.email : null,
    });
  }
  if (!optionUserIds.has(user.id)) {
    paidByMemberOptions.push({
      userId: user.id,
      label: currentUserDisplayLabel,
      email: user.email ?? null,
    });
  }
  paidByMemberOptions.sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );

  const defaultPaidBy = currentUserDisplayLabel;
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
    const isPaidByYou = paidByIsCurrentUser(
      paidBy,
      user.id,
      user.email ?? undefined,
      currentUserDisplayLabel,
    );

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

      const createdByUserId =
        expense.user_id != null && String(expense.user_id).length > 0
          ? String(expense.user_id)
          : null;
      const canManage =
        isOrganizer || (createdByUserId != null && createdByUserId === user.id);

      return {
        id: expenseId,
        title,
        amount,
        paidBy,
        splitTypeRaw,
        dateLabel,
        dateInput,
        myShare: computeMyShare(expense),
        isPaidByYou: expensePaidByCurrentUser(
          expense,
          user.id,
          user.email ?? undefined,
          currentUserDisplayLabel,
        ),
        createdByUserId,
        canManage,
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
          paidByMemberOptions={paidByMemberOptions}
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
