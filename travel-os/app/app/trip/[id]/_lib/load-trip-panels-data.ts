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
import type { TripTabKey } from "@/app/app/trip/[id]/_lib/trip-tab-keys";

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

/** When `expense_participants` rows exist, each member's `computed_amount` is the canonical share. */
function resolveYourShare(
  expense: ExpenseRecord,
  expenseId: string,
  currentUserId: string,
  computedByUserIdByExpense: Map<string, Map<string, number>>,
): number {
  const fromParticipant = computedByUserIdByExpense.get(expenseId)?.get(currentUserId);
  if (fromParticipant !== undefined) return fromParticipant;

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
  const paidByUserId = pickFirstString(expense, ["paid_by_user_id"], "");
  if (paidByUserId && paidByUserId === userId) return true;
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

function normalizeProfileName(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function resolvePaidByDisplayLabel(
  paidByRaw: string,
  options: PaidByMemberOption[],
): string {
  const paidBy = paidByRaw.trim();
  if (!paidBy) return "Unknown";

  const lower = paidBy.toLowerCase();
  const byUserId = options.find((o) => o.userId === paidBy);
  if (byUserId) return byUserId.label;

  const byLabel = options.find((o) => o.label.toLowerCase() === lower);
  if (byLabel) return byLabel.label;

  const byEmail = options.find((o) => (o.email ?? "").toLowerCase() === lower);
  if (byEmail) return byEmail.label;

  const byEmailLocal = options.find((o) => {
    const local = (o.email ?? "").split("@")[0]?.toLowerCase();
    return !!local && local === lower;
  });
  if (byEmailLocal) return byEmailLocal.label;

  return paidBy;
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
    activeTab: TripTabKey;
    expensesError: string;
    docsSuccess: string;
    docsError: string;
    membersError: string;
  },
): Promise<TripTabPanelsData> {
  const wantsExpenses = query.activeTab === "expenses";
  const wantsConnect = query.activeTab === "connect";
  const wantsDocs = wantsConnect;
  const wantsChat = wantsConnect;
  const wantsMembers = wantsConnect;
  const needsRole = wantsExpenses || wantsConnect;

  const memberRole = needsRole ? await getMemberRole(supabase, tripId, user.id) : null;
  const isOrganizer = memberRole === "organizer";

  const [{ data: expensesData }, { data: expenseCommentsData }, { data: membersForExpenseLabels }] =
    wantsExpenses
      ? await Promise.all([
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
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const { data: documentsData } = wantsDocs
    ? await supabase
        .from("documents")
        .select("id, file_name, file_url, created_at")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })
    : { data: [] };

  const [{ data: messagesData }, { data: membersDataChat }] = wantsChat
    ? await Promise.all([
        supabase
          .from("messages")
          .select("id, trip_id, user_id, content, created_at")
          .eq("trip_id", tripId)
          .order("created_at", { ascending: true }),
        supabase.from("members").select("user_id, name, email").eq("trip_id", tripId),
      ])
    : [{ data: [] }, { data: [] }];

  const { data: membersRowsData, error: membersListError } = wantsMembers
    ? await supabase.from("members").select("*").eq("trip_id", tripId).order("created_at", { ascending: true })
    : { data: [], error: null };

  const profileRes = wantsExpenses || wantsConnect
    ? await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle()
    : { data: null, error: null };

  const expenses = (expensesData ?? []) as ExpenseRecord[];
  const expenseIds = expenses
    .map((e) => (e.id != null && String(e.id).length > 0 ? String(e.id) : null))
    .filter((id): id is string => id != null);

  const computedByUserIdByExpense = new Map<string, Map<string, number>>();
  if (expenseIds.length > 0) {
    const { data: participantRows } = await supabase
      .from("expense_participants")
      .select("expense_id, user_id, computed_amount")
      .in("expense_id", expenseIds);
    for (const raw of participantRows ?? []) {
      const row = raw as ExpenseRecord;
      const eid =
        row.expense_id != null && String(row.expense_id).length > 0
          ? String(row.expense_id)
          : "";
      const uid =
        row.user_id != null && String(row.user_id).length > 0 ? String(row.user_id) : "";
      if (!eid || !uid) continue;
      const computed = pickFirstNumber(row, ["computed_amount"]);
      if (!computedByUserIdByExpense.has(eid)) computedByUserIdByExpense.set(eid, new Map());
      computedByUserIdByExpense.get(eid)!.set(uid, computed);
    }
  }

  const expenseCommentsById = groupCommentsByEntityId(
    (expenseCommentsData ?? []) as EntityCommentDTO[],
  );

  const memberUserIds = Array.from(
    new Set(
      [...(membersForExpenseLabels ?? []), ...(membersDataChat ?? []), ...(membersRowsData ?? [])]
        .map((row) => {
          const userId = (row as { user_id?: string | number | null }).user_id;
          return userId == null ? "" : String(userId);
        })
        .filter((id) => id.length > 0),
    ),
  );

  const { data: profilesData } =
    memberUserIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", memberUserIds)
      : { data: [] as Array<{ id: string; name: string | null }> };

  const profileNameByUserId: Record<string, string> = {};
  for (const row of profilesData ?? []) {
    const id = typeof row.id === "string" ? row.id : String(row.id ?? "");
    const name = normalizeProfileName(row.name);
    if (id && name) profileNameByUserId[id] = name;
  }

  const memberLabelByUserId: Record<string, string> = {};
  for (const row of membersForExpenseLabels ?? []) {
    const m = row as MemberLabelRow;
    if (m.user_id) {
      const uid = String(m.user_id);
      memberLabelByUserId[uid] = profileNameByUserId[uid] || memberDisplayLabel(m);
    }
  }
  const metaName = user.user_metadata?.full_name;
  const profileRow = profileRes.error ? null : profileRes.data;
  const profileNameFromDb = profileRow ? normalizeProfileName(profileRow.name) : "";
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
  const memberCount = wantsExpenses ? await countTripMembers(supabase, tripId) : 0;

  const totalSpent = expenses.reduce(
    (sum, expense) => sum + pickFirstNumber(expense, ["amount", "total_amount"]),
    0,
  );

  const yourShareTotal = expenses.reduce((sum, expense) => {
    const expenseId =
      expense.id != null && String(expense.id).length > 0 ? String(expense.id) : "";
    if (!expenseId) return sum;
    return sum + resolveYourShare(expense, expenseId, user.id, computedByUserIdByExpense);
  }, 0);

  const netBalance = expenses.reduce((sum, expense) => {
    const expenseId =
      expense.id != null && String(expense.id).length > 0 ? String(expense.id) : "";
    if (!expenseId) return sum;

    const amount = pickFirstNumber(expense, ["amount", "total_amount"]);
    const isPaidByYou = expensePaidByCurrentUser(
      expense,
      user.id,
      user.email ?? undefined,
      currentUserDisplayLabel,
    );

    const share = resolveYourShare(expense, expenseId, user.id, computedByUserIdByExpense);

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
      const paidBy = resolvePaidByDisplayLabel(
        pickFirstString(expense, ["paid_by", "payer"], "Unknown"),
        paidByMemberOptions,
      );
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
        myShare: resolveYourShare(expense, expenseId, user.id, computedByUserIdByExpense),
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
      const uid = String(m.user_id);
      chatMemberLabelByUserId[uid] =
        profileNameByUserId[uid] || chatMemberDisplayLabel(m);
    }
  }
  if (!chatMemberLabelByUserId[user.id]) {
    chatMemberLabelByUserId[user.id] =
      (typeof metaName === "string" && metaName.trim()) ||
      user.email?.split("@")[0] ||
      "You";
  }

  const inviteCode = wantsMembers ? pickFirstString(tripRow, ["invite_code"], "").trim() : "";
  const baseUrl = wantsMembers ? await getResolvedPublicSiteUrl() : "";
  const inviteBaseUrl = baseUrl.replace("travel-os", "traveltill99");
  const hasInviteCode = inviteCode.length > 0;
  const joinUrl = hasInviteCode
    ? `${inviteBaseUrl}/join?code=${encodeURIComponent(inviteCode)}`
    : `${inviteBaseUrl}/join`;
  const whatsappText = hasInviteCode
    ? `Join my trip: ${joinUrl}`
    : `Join my trip on TravelTill99: ${joinUrl}`;
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  const memberRowsResolved: GenericRecord[] = (membersRowsData ?? []).map((row) => {
    const base = row as GenericRecord;
    const userIdRaw = (row as { user_id?: string | number | null }).user_id;
    const uid = userIdRaw == null ? "" : String(userIdRaw);
    if (!uid) return base;
    const profileName = profileNameByUserId[uid];
    const currentUserFallbackName =
      uid === user.id
        ? profileNameFromDb ||
          (typeof metaName === "string" && metaName.trim().length > 0 ? metaName.trim() : "")
        : "";
    const resolvedName = profileName || currentUserFallbackName;
    if (!resolvedName) return base;
    return { ...base, name: resolvedName };
  });

  const membersPanel: TripMembersPanelProps = {
    tripId,
    tripTitle,
    pageError: query.membersError,
    inviteCode,
    canInvite: memberRole === "organizer",
    joinUrl,
    whatsappLink,
    hasInviteCode,
    rows: memberRowsResolved,
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
