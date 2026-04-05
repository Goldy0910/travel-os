import type { TripMembersPanelProps } from "@/app/app/trip/[id]/_components/trip-members-panel";
import type { DocumentDTO } from "@/app/app/trip/[id]/docs/_components/trip-docs-client";
import type { ChatMessageDTO } from "@/app/app/trip/[id]/chat/_components/trip-chat-client";
import type {
  ExpenseCardDTO,
  PaidByMemberOption,
} from "@/app/app/trip/[id]/expenses/_components/trip-expenses-client";
import type { EntityCommentDTO } from "@/app/app/trip/[id]/_components/entity-comments-block";
import {
  groupCommentsByEntityId,
  memberDisplayLabel,
  type MemberLabelRow,
} from "@/lib/trip-entity-comments";
import { getResolvedPublicSiteUrl } from "@/lib/public-site-url";
import { countTripMembers, getMemberRole } from "@/lib/trip-membership";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type TripRecord = Record<string, string | number | null>;
type ExpenseRecord = Record<string, string | number | null>;
type GenericRecord = Record<string, string | number | null>;

function pickFirstString(record: TripRecord | ExpenseRecord | GenericRecord, keys: string[], fallback: string) {
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

type MemberRow = { user_id: string | null; name: string | null; email: string | null };

function chatMemberDisplayLabel(m: MemberRow): string {
  const name = typeof m.name === "string" ? m.name.trim() : "";
  if (name.length > 0) return name;
  const email = typeof m.email === "string" ? m.email.trim() : "";
  if (email.length > 0) return email.split("@")[0] ?? email;
  return "Member";
}

export type TripTabPanelsData = {
  expenses: {
    tripTitle: string;
    defaultPaidBy: string;
    paidByMemberOptions: PaidByMemberOption[];
    memberCount: number;
    totalSpent: number;
    yourShareTotal: number;
    netBalance: number;
    expenses: ExpenseCardDTO[];
    initialError: string;
    currentUserId: string;
    memberLabelByUserId: Record<string, string>;
    expenseCommentsById: Record<string, EntityCommentDTO[]>;
  };
  docs: {
    documents: DocumentDTO[];
    initialSuccess: string;
    initialError: string;
  };
  chat: {
    initialMessages: ChatMessageDTO[];
    memberLabelByUserId: Record<string, string>;
  };
  members: TripMembersPanelProps;
};

export async function loadTripTabPanelsData(
  supabase: SupabaseClient,
  tripId: string,
  user: User,
  tripRow: TripRecord,
  tripTitle: string,
  query: {
    expensesError: string;
    docsSuccess: string;
    docsError: string;
    membersError: string;
  },
): Promise<TripTabPanelsData> {
  const memberRole = await getMemberRole(supabase, tripId, user.id);
  const isOrganizer = memberRole === "organizer";

  const [
    { data: expensesData },
    { data: expenseCommentsData },
    { data: membersForExpenseLabels },
    profileRes,
    { data: documentsData },
    { data: messagesData },
    { data: membersDataChat },
    { data: membersRowsData, error: membersListError },
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
    supabase
      .from("documents")
      .select("id, file_name, file_url, created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("id, trip_id, user_id, content, created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
    supabase.from("members").select("user_id, name, email").eq("trip_id", tripId),
    supabase.from("members").select("*").eq("trip_id", tripId).order("created_at", { ascending: true }),
  ]);

  const expenses = (expensesData ?? []) as ExpenseRecord[];
  const expenseCommentsById = groupCommentsByEntityId(
    (expenseCommentsData ?? []) as EntityCommentDTO[],
  );

  const memberLabelByUserId: Record<string, string> = {};
  for (const row of membersForExpenseLabels ?? []) {
    const m = row as MemberLabelRow;
    if (m.user_id) {
      memberLabelByUserId[m.user_id] = memberDisplayLabel(m);
    }
  }
  const metaName = user.user_metadata?.full_name;
  const profileRow = profileRes.error ? null : profileRes.data;
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
  for (const row of membersForExpenseLabels ?? []) {
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

  const documents: DocumentDTO[] = (documentsData ?? []).map(
    (row: { id: string | number; file_name: string | null; file_url: string | null; created_at?: string | null }) => ({
      id: String(row.id),
      file_name: row.file_name,
      file_url: row.file_url,
      created_at: row.created_at ?? null,
    }),
  );

  const initialMessages = (messagesData ?? []) as ChatMessageDTO[];

  const chatMemberLabelByUserId: Record<string, string> = {};
  for (const row of membersDataChat ?? []) {
    const m = row as MemberRow;
    if (m.user_id) {
      chatMemberLabelByUserId[m.user_id] = chatMemberDisplayLabel(m);
    }
  }
  if (!chatMemberLabelByUserId[user.id]) {
    chatMemberLabelByUserId[user.id] =
      (typeof metaName === "string" && metaName.trim()) ||
      user.email?.split("@")[0] ||
      "You";
  }

  const inviteCode = pickFirstString(tripRow, ["invite_code"], "").trim();
  const baseUrl = await getResolvedPublicSiteUrl();
  const hasInviteCode = inviteCode.length > 0;
  const joinUrl = hasInviteCode
    ? `${baseUrl}/join?code=${encodeURIComponent(inviteCode)}`
    : `${baseUrl}/join`;
  const whatsappText = hasInviteCode
    ? `Join my trip: ${joinUrl}`
    : `Join my trip on Travel OS: ${joinUrl}`;
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  const membersPanel: TripMembersPanelProps = {
    tripId,
    tripTitle,
    pageError: query.membersError,
    inviteCode,
    canInvite: memberRole === "organizer",
    joinUrl,
    whatsappLink,
    hasInviteCode,
    rows: (membersRowsData ?? []) as GenericRecord[],
    membersError: membersListError,
  };

  return {
    expenses: {
      tripTitle,
      defaultPaidBy,
      paidByMemberOptions,
      memberCount,
      totalSpent,
      yourShareTotal,
      netBalance,
      expenses: expenseRows,
      initialError: query.expensesError,
      currentUserId: user.id,
      memberLabelByUserId,
      expenseCommentsById,
    },
    docs: {
      documents,
      initialSuccess: query.docsSuccess,
      initialError: query.docsError,
    },
    chat: {
      initialMessages,
      memberLabelByUserId: chatMemberLabelByUserId,
    },
    members: membersPanel,
  };
}
