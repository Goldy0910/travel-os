import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMemberRole, isTripMember } from "@/lib/trip-membership";
import type { ToolContext, ToolFailure } from "@/lib/tools/types";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type MemberToolAuth = {
  supabase: SupabaseClient;
  user: User;
  tripId: string;
  role: string | null;
};

/**
 * Authenticate the current user and confirm trip membership.
 * When `organizerOnly` is true, requires organizer role.
 */
export async function requireMemberToolAuth(
  tripIdRaw: string | undefined,
  ctx: ToolContext,
  options?: { organizerOnly?: boolean },
): Promise<MemberToolAuth | ToolFailure> {
  const tripId = (tripIdRaw || ctx.tripId || "").trim();
  if (!tripId) {
    return { ok: false, error: "tripId is required", code: "INVALID_INPUT" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Authentication required", code: "UNAUTHORIZED" };
  }

  if (ctx.userId && ctx.userId !== user.id) {
    return { ok: false, error: "User context mismatch", code: "UNAUTHORIZED" };
  }

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) {
    return {
      ok: false,
      error: "Trip not found or access denied",
      code: "UNAUTHORIZED",
    };
  }

  const role = await getMemberRole(supabase, tripId, user.id);

  if (options?.organizerOnly && role !== "organizer") {
    return {
      ok: false,
      error: "Only organizers can perform this action",
      code: "UNAUTHORIZED",
    };
  }

  return { supabase, user, tripId, role };
}

export function isToolFailure(value: unknown): value is ToolFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ToolFailure).ok === false &&
    typeof (value as ToolFailure).error === "string"
  );
}
