import type { SupabaseClient } from "@supabase/supabase-js";

type FetchTripsViaMembershipOptions = {
  /** Passed to `trips(...)` in the embed, e.g. `*` or `id, title, location` */
  tripColumns?: string;
};

/**
 * Load trips only where the user has a `members` row (membership-first embed).
 * Equivalent to: `select * from trips where exists (select 1 from members where …)`.
 */
export async function fetchTripsViaMembership(
  supabase: SupabaseClient,
  userId: string,
  options?: FetchTripsViaMembershipOptions,
): Promise<{
  trips: Record<string, unknown>[];
  tripIds: string[];
  error: { message: string } | null;
}> {
  const cols = options?.tripColumns ?? "*";
  const { data, error } = await supabase
    .from("members")
    .select(`trip_id, trips(${cols})`)
    .eq("user_id", userId);

  if (error) {
    return { trips: [], tripIds: [], error: { message: error.message } };
  }

  type MemberTripRow = {
    trip_id?: string;
    trips?: Record<string, unknown> | Record<string, unknown>[] | null;
  };
  const rows = (data ?? []) as MemberTripRow[];

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const nested = row.trips;
    const trip = Array.isArray(nested) ? nested[0] : nested;
    if (trip?.id != null) {
      byId.set(String(trip.id), trip);
    }
  }

  const trips = [...byId.values()];
  const tripIds = [...byId.keys()];
  return { trips, tripIds, error: null };
}

/**
 * Trip IDs from `members` only (lightweight when you do not need trip rows).
 */
export async function getTripIdsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("members")
    .select("trip_id")
    .eq("user_id", userId);

  if (error || !data?.length) {
    return [];
  }

  const ids = new Set<string>();
  for (const row of data) {
    const tid = row.trip_id as string | undefined;
    if (tid) ids.add(String(tid));
  }
  return [...ids];
}

/** Matches DB `is_trip_member` (members row with `user_id` set). Trip listing uses this; `trips` SELECT in DB also allows row owner during create. */
export async function isTripMember(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
): Promise<boolean> {
  const { data: memberRow } = await supabase
    .from("members")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  return !!memberRow;
}

/** Organizer/member from `members` row only (matches strict trip RLS). */
export async function getMemberRole(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.role != null && String(data.role).length > 0) {
    return data.role as string;
  }

  return null;
}

export async function countTripMembers(
  supabase: SupabaseClient,
  tripId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId);

  if (error) return 0;
  return count ?? 0;
}
