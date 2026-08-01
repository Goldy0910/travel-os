import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import type { ToolContext, ToolFailure } from "@/lib/tools/types";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type DocumentToolAuth = {
  supabase: SupabaseClient;
  user: User;
  tripId: string;
};

export type DocumentToolAuthResult =
  | { ok: true; auth: DocumentToolAuth }
  | ToolFailure;

export async function requireDocumentToolAuth(
  tripIdRaw: string | undefined,
  ctx: ToolContext,
): Promise<DocumentToolAuthResult> {
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

  return { ok: true, auth: { supabase, user, tripId } };
}

export type DocumentRow = {
  id: string;
  trip_id: string;
  user_id: string | null;
  file_name: string | null;
  file_url: string | null;
  created_at: string | null;
};

export async function fetchTripDocument(
  supabase: SupabaseClient,
  tripId: string,
  documentId: string,
): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, trip_id, user_id, file_name, file_url, created_at")
    .eq("id", documentId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: String(data.id),
    trip_id: String(data.trip_id),
    user_id: data.user_id != null ? String(data.user_id) : null,
    file_name: data.file_name != null ? String(data.file_name) : null,
    file_url: data.file_url != null ? String(data.file_url) : null,
    created_at: data.created_at != null ? String(data.created_at) : null,
  };
}
