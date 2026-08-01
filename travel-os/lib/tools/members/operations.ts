import {
  computeExpenseSplit,
  type SplitType,
} from "@/app/app/trip/[id]/expenses/_lib/expense-split";
import { getPublicSiteUrl, getResolvedPublicSiteUrl } from "@/lib/public-site-url";
import { getMemberRole } from "@/lib/trip-membership";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export type MemberRow = {
  id: string;
  trip_id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
};

export type MemberMentionPayload = {
  type: "member";
  userId: string | null;
  displayName: string;
  memberId: string;
  role: string;
  email: string | null;
  mentionText: string;
};

function displayLabelForMember(row: {
  name?: string | null;
  email?: string | null;
  user_id?: string | null;
}): string {
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (name.length > 0) return name;
  const email = typeof row.email === "string" ? row.email.trim() : "";
  if (email.length > 0) return email.split("@")[0] || email;
  if (row.user_id) return "Member";
  return "Guest";
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function resolveInviteBaseUrl(): Promise<string> {
  try {
    return await getResolvedPublicSiteUrl();
  } catch {
    return getPublicSiteUrl();
  }
}

export async function buildTripInviteUrls(
  supabase: SupabaseClient,
  tripId: string,
): Promise<{ inviteCode: string; joinUrl: string; hasInviteCode: boolean }> {
  const { data: trip } = await supabase
    .from("trips")
    .select("invite_code")
    .eq("id", tripId)
    .maybeSingle();

  const inviteCode =
    trip?.invite_code != null ? String(trip.invite_code).trim() : "";
  const baseUrl = await resolveInviteBaseUrl();
  const hasInviteCode = inviteCode.length > 0;
  const joinUrl = hasInviteCode
    ? `${baseUrl}/join?code=${encodeURIComponent(inviteCode)}`
    : `${baseUrl}/join`;

  return { inviteCode, joinUrl, hasInviteCode };
}

function revalidateMemberPaths(tripId: string) {
  revalidatePath(`/app/trip/${tripId}/members`);
  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath("/app/trips");
  revalidatePath("/app/home");
  revalidatePath("/app/docs");
  revalidatePath("/app/expenses");
  revalidatePath("/app/members");
}

function revalidateExpensePaths(tripId: string) {
  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath(`/app/trip/${tripId}/expenses`);
  revalidatePath("/app/home");
  revalidatePath("/app/expenses");
}

/**
 * Invite a member by email (pending row) and/or return the trip invite link.
 * Organizer-only — caller must enforce role.
 */
export async function inviteTripMember(
  supabase: SupabaseClient,
  input: {
    tripId: string;
    email?: string;
    name?: string;
  },
): Promise<
  | {
      ok: true;
      data: {
        joinUrl: string;
        inviteCode: string;
        hasInviteCode: boolean;
        pendingInvite: null | {
          memberId: string;
          email: string;
          name: string;
          role: string;
        };
      };
    }
  | { ok: false; error: string; code?: string }
> {
  const emailRaw = input.email?.trim() ?? "";
  const nameRaw = input.name?.trim() ?? "";

  let pendingInvite: {
    memberId: string;
    email: string;
    name: string;
    role: string;
  } | null = null;

  if (emailRaw) {
    const email = normalizeEmail(emailRaw);
    if (!isValidEmail(email)) {
      return { ok: false, error: "A valid email is required to invite", code: "INVALID_INPUT" };
    }

    const { data: existing } = await supabase
      .from("members")
      .select("id, user_id, email, role")
      .eq("trip_id", input.tripId);

    const already = (existing ?? []).find((row) => {
      const rowEmail =
        typeof row.email === "string" ? normalizeEmail(row.email) : "";
      return rowEmail === email;
    });

    if (already) {
      return {
        ok: false,
        error: already.user_id
          ? "That person is already a member of this trip"
          : "A pending invite already exists for that email",
        code: "INVALID_INPUT",
      };
    }

    const displayName = nameRaw || email.split("@")[0] || email;
    const { data: inserted, error } = await supabase
      .from("members")
      .insert({
        trip_id: input.tripId,
        user_id: null,
        email,
        name: displayName,
        role: "member",
      })
      .select("id, email, name, role")
      .single();

    if (error || !inserted?.id) {
      return {
        ok: false,
        error: error?.message || "Could not create invite",
        code: "HANDLER_ERROR",
      };
    }

    pendingInvite = {
      memberId: String(inserted.id),
      email: String(inserted.email ?? email),
      name: String(inserted.name ?? displayName),
      role: String(inserted.role ?? "member"),
    };
  }

  const urls = await buildTripInviteUrls(supabase, input.tripId);
  revalidateMemberPaths(input.tripId);

  return {
    ok: true,
    data: {
      joinUrl: urls.joinUrl,
      inviteCode: urls.inviteCode,
      hasInviteCode: urls.hasInviteCode,
      pendingInvite,
    },
  };
}

/**
 * Remove a trip member. Mirrors deleteMemberAction persistence rules.
 * Organizer-only — caller must enforce role.
 */
export async function removeTripMember(
  supabase: SupabaseClient,
  input: {
    tripId: string;
    memberId?: string;
    userId?: string;
    email?: string;
  },
): Promise<
  | { ok: true; data: { removedMemberId: string; removedUserId: string | null } }
  | { ok: false; error: string; code?: string }
> {
  const memberId = input.memberId?.trim() ?? "";
  const userId = input.userId?.trim() ?? "";
  const email = input.email ? normalizeEmail(input.email) : "";

  if (!memberId && !userId && !email) {
    return {
      ok: false,
      error: "Provide memberId, userId, or email to remove",
      code: "INVALID_INPUT",
    };
  }

  let query = supabase
    .from("members")
    .select("id, user_id, email, role")
    .eq("trip_id", input.tripId);

  if (memberId) query = query.eq("id", memberId);
  else if (userId) query = query.eq("user_id", userId);
  else query = query.eq("email", email);

  const { data: row } = await query.maybeSingle();

  if (!row?.id) {
    return { ok: false, error: "Member not found", code: "INVALID_INPUT" };
  }

  if (row.role === "organizer") {
    const { count, error: cErr } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", input.tripId)
      .eq("role", "organizer");

    if (!cErr && (count ?? 0) <= 1) {
      return {
        ok: false,
        error:
          "This trip must keep at least one organizer. Add another organizer first.",
        code: "INVALID_INPUT",
      };
    }
  }

  const baseDelete = supabase.from("members").delete().eq("trip_id", input.tripId);
  let deleteError: { message: string } | null = null;

  if (row.user_id != null) {
    const { error } = await baseDelete.eq("user_id", row.user_id);
    deleteError = error;
  } else if (typeof row.email === "string" && row.email.trim().length > 0) {
    const { error } = await baseDelete.eq("email", row.email.trim());
    deleteError = error;
  } else {
    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", String(row.id))
      .eq("trip_id", input.tripId);
    deleteError = error;
  }

  if (deleteError) {
    return {
      ok: false,
      error: deleteError.message || "Could not remove member",
      code: "HANDLER_ERROR",
    };
  }

  revalidateMemberPaths(input.tripId);

  return {
    ok: true,
    data: {
      removedMemberId: String(row.id),
      removedUserId: row.user_id != null ? String(row.user_id) : null,
    },
  };
}

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

/**
 * Assign (or reassign) who paid an expense. Updates payer fields and
 * recomputes participant owes when split rows exist.
 */
export async function assignExpensePayer(
  supabase: SupabaseClient,
  input: {
    tripId: string;
    expenseId: string;
    payerUserId: string;
    actorUserId: string;
  },
): Promise<
  | {
      ok: true;
      data: {
        expenseId: string;
        payerUserId: string;
        payerDisplayName: string;
      };
    }
  | { ok: false; error: string; code?: string }
> {
  const expenseId = input.expenseId.trim();
  const payerUserId = input.payerUserId.trim();
  if (!expenseId || !payerUserId) {
    return {
      ok: false,
      error: "expenseId and payerUserId are required",
      code: "INVALID_INPUT",
    };
  }

  const { data: payerMember } = await supabase
    .from("members")
    .select("id, user_id, name, email")
    .eq("trip_id", input.tripId)
    .eq("user_id", payerUserId)
    .maybeSingle();

  if (!payerMember?.user_id) {
    return {
      ok: false,
      error: "Payer must be an active member of this trip",
      code: "INVALID_INPUT",
    };
  }

  const payerDisplayName = displayLabelForMember(payerMember);

  const { data: expense } = await supabase
    .from("expenses")
    .select(
      "id, user_id, amount, total_amount, split_type, paid_by_user_id, paid_by, payer",
    )
    .eq("id", expenseId)
    .eq("trip_id", input.tripId)
    .maybeSingle();

  if (!expense?.id) {
    return { ok: false, error: "Expense not found", code: "INVALID_INPUT" };
  }

  const creatorId =
    expense.user_id != null && String(expense.user_id).length > 0
      ? String(expense.user_id)
      : null;

  if (!(await canMutateExpense(supabase, input.tripId, input.actorUserId, creatorId))) {
    return {
      ok: false,
      error: "Only the person who added this expense or an organiser can change the payer",
      code: "UNAUTHORIZED",
    };
  }

  const amount = Number(expense.amount ?? expense.total_amount ?? 0);
  const splitTypeRaw = String(expense.split_type ?? "none");
  const splitType = (
    ["equal", "exact", "percentage", "none"].includes(splitTypeRaw)
      ? splitTypeRaw
      : "none"
  ) as SplitType;

  const { error: updateError } = await supabase
    .from("expenses")
    .update({
      paid_by: payerUserId,
      paid_by_user_id: payerUserId,
      payer: payerUserId,
    })
    .eq("id", expenseId)
    .eq("trip_id", input.tripId);

  if (updateError) {
    return {
      ok: false,
      error: updateError.message || "Could not update payer",
      code: "HANDLER_ERROR",
    };
  }

  const { data: participants } = await supabase
    .from("expense_participants")
    .select("user_id, split_value, split_type, computed_amount, owes_amount")
    .eq("expense_id", expenseId);

  if (participants && participants.length > 0 && Number.isFinite(amount) && amount > 0) {
    const selectedParticipantIds = participants
      .map((row) => (row.user_id != null ? String(row.user_id) : ""))
      .filter(Boolean);

    const oldPayerId =
      expense.paid_by_user_id != null ? String(expense.paid_by_user_id) : "";
    const oldPayerRow = participants.find(
      (row) => row.user_id != null && String(row.user_id) === oldPayerId,
    );
    const includePayerInEqual = oldPayerRow
      ? Number(oldPayerRow.computed_amount ?? 0) > 0
      : true;

    const exactAmountsByUserId: Record<string, number> = {};
    const percentagesByUserId: Record<string, number> = {};
    for (const row of participants) {
      const uid = row.user_id != null ? String(row.user_id) : "";
      if (!uid) continue;
      const splitValue = Number(row.split_value ?? 0);
      if (String(row.split_type) === "percentage" || splitType === "percentage") {
        percentagesByUserId[uid] = splitValue;
      } else {
        exactAmountsByUserId[uid] = splitValue;
      }
    }

    // Ensure new payer is available for settlement row creation.
    if (!selectedParticipantIds.includes(payerUserId) && splitType !== "none") {
      selectedParticipantIds.push(payerUserId);
    }

    const split = computeExpenseSplit({
      amount,
      splitType,
      paidByUserId: payerUserId,
      selectedParticipantIds,
      includePayerInEqual,
      exactAmountsByUserId,
      percentagesByUserId,
    });

    if (split.errors.length === 0) {
      await supabase.from("expense_participants").delete().eq("expense_id", expenseId);
      if (split.rows.length > 0) {
        const { error: participantsError } = await supabase
          .from("expense_participants")
          .insert(
            split.rows.map((row) => ({
              expense_id: expenseId,
              user_id: row.userId,
              split_value: row.splitValue,
              split_type: row.splitType,
              computed_amount: row.computedAmount,
              owes_amount: row.owesAmount,
            })),
          );
        if (participantsError) {
          return {
            ok: false,
            error: participantsError.message || "Could not update split after payer change",
            code: "HANDLER_ERROR",
          };
        }
      }
    }
  }

  revalidateExpensePaths(input.tripId);

  return {
    ok: true,
    data: {
      expenseId,
      payerUserId,
      payerDisplayName,
    },
  };
}

/**
 * Resolve a trip member for chat/AI mentions. Returns a structured mention payload.
 */
export async function resolveMemberMention(
  supabase: SupabaseClient,
  input: {
    tripId: string;
    userId?: string;
    query?: string;
  },
): Promise<
  | { ok: true; data: MemberMentionPayload & { matches?: MemberMentionPayload[] } }
  | { ok: false; error: string; code?: string }
> {
  const userId = input.userId?.trim() ?? "";
  const query = input.query?.trim() ?? "";

  if (!userId && !query) {
    return {
      ok: false,
      error: "Provide userId or query to mention a member",
      code: "INVALID_INPUT",
    };
  }

  const { data: members, error } = await supabase
    .from("members")
    .select("id, user_id, name, email, role")
    .eq("trip_id", input.tripId);

  if (error) {
    return {
      ok: false,
      error: error.message || "Could not load members",
      code: "HANDLER_ERROR",
    };
  }

  const rows = (members ?? []) as Array<{
    id: string | number;
    user_id: string | null;
    name: string | null;
    email: string | null;
    role: string | null;
  }>;

  const profileIds = rows
    .map((r) => (r.user_id != null ? String(r.user_id) : ""))
    .filter(Boolean);

  const profileNameByUserId: Record<string, string> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", profileIds);
    for (const profile of profiles ?? []) {
      const id = profile.id != null ? String(profile.id) : "";
      const name =
        typeof profile.name === "string" && profile.name.trim()
          ? profile.name.trim()
          : "";
      if (id && name) profileNameByUserId[id] = name;
    }
  }

  const toMention = (row: (typeof rows)[number]): MemberMentionPayload => {
    const uid = row.user_id != null ? String(row.user_id) : null;
    const displayName =
      (uid && profileNameByUserId[uid]) || displayLabelForMember(row);
    return {
      type: "member",
      userId: uid,
      displayName,
      memberId: String(row.id),
      role: String(row.role ?? "member"),
      email: typeof row.email === "string" ? row.email : null,
      mentionText: `@${displayName}`,
    };
  };

  if (userId) {
    const exact = rows.find(
      (row) => row.user_id != null && String(row.user_id) === userId,
    );
    if (!exact) {
      return {
        ok: false,
        error: "No trip member found for that userId",
        code: "INVALID_INPUT",
      };
    }
    return { ok: true, data: toMention(exact) };
  }

  const q = query.toLowerCase();
  const matches = rows
    .map(toMention)
    .filter((m) => {
      const hay = [
        m.displayName,
        m.email ?? "",
        m.userId ?? "",
        m.mentionText,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

  if (matches.length === 0) {
    return {
      ok: false,
      error: `No trip members matched "${query}"`,
      code: "INVALID_INPUT",
    };
  }

  // Prefer exact display-name / email local-part matches, else first match.
  const exactName = matches.find(
    (m) => m.displayName.toLowerCase() === q || m.mentionText.toLowerCase() === `@${q}`,
  );
  const primary = exactName ?? matches[0]!;

  return {
    ok: true,
    data: {
      ...primary,
      ...(matches.length > 1 ? { matches } : {}),
    },
  };
}
