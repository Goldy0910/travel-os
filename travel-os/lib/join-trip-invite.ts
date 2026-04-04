import type { SupabaseClient } from "@supabase/supabase-js";
import { PENDING_TRIP_INVITE_KEY } from "@/lib/pending-trip-invite";
import { tripIdFromJson } from "@/lib/trip-id-from-json";

type RouterLike = {
  push: (href: string) => void;
  refresh: () => void;
};

/**
 * If a pending invite code is in localStorage, call join RPC and navigate to the trip.
 * @returns true if navigation to a trip was triggered
 */
export async function tryConsumePendingInvite(
  supabase: SupabaseClient,
  router: RouterLike,
): Promise<boolean> {
  let code = "";
  try {
    code = localStorage.getItem(PENDING_TRIP_INVITE_KEY)?.trim() ?? "";
  } catch {
    return false;
  }
  if (code.length < 8) return false;

  const { data, error } = await supabase.rpc("join_trip_by_invite_code", {
    p_code: code,
  });

  if (error) {
    return false;
  }

  const row = data as { ok?: boolean; trip_id?: unknown } | null;
  const tripId = row?.ok === true ? tripIdFromJson(row?.trip_id) : undefined;
  if (tripId) {
    try {
      localStorage.removeItem(PENDING_TRIP_INVITE_KEY);
    } catch {
      /* ignore */
    }
    router.push(`/app/trip/${tripId}?welcome=1`);
    router.refresh();
    return true;
  }

  try {
    localStorage.removeItem(PENDING_TRIP_INVITE_KEY);
  } catch {
    /* ignore */
  }
  return false;
}
