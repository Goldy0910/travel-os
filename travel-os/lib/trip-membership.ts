import type { SupabaseClient } from "@supabase/supabase-js";

type FetchTripsViaMembershipOptions = {
  /** Passed to `trips(...)` in the embed, e.g. `*` or `id, title, location` */
  tripColumns?: string;
};

function asRecordRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  const rows: Record<string, unknown>[] = [];
  for (const row of data) {
    if (row != null && typeof row === "object" && !Array.isArray(row)) {
      rows.push(row as Record<string, unknown>);
    }
  }
  return rows;
}

function asTripRow(
  value: Record<string, unknown> | Record<string, unknown>[] | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;
  const trip = Array.isArray(value) ? value[0] : value;
  if (!trip || trip.id == null) return null;
  return trip;
}

function tripSortKey(trip: Record<string, unknown>): string {
  const start =
    (typeof trip.start_date === "string" && trip.start_date) ||
    (typeof trip.created_at === "string" && trip.created_at) ||
    "";
  return start;
}

function sortTripsNewestFirst(trips: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...trips].sort((a, b) => {
    const ak = tripSortKey(a);
    const bk = tripSortKey(b);
    if (ak && bk) return bk.localeCompare(ak);
    if (ak) return -1;
    if (bk) return 1;
    return String(b.id ?? "").localeCompare(String(a.id ?? ""));
  });
}

/**
 * Load every trip the user created or belongs to.
 * Membership-first, then union with `trips.user_id` ownership (covers legacy rows
 * missing an organizer members entry). Best-effort backfills organizer membership.
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
  const byId = new Map<string, Record<string, unknown>>();
  let firstError: { message: string } | null = null;

  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .select(`trip_id, trips(${cols})`)
    .eq("user_id", userId)
    .limit(500);

  if (memberError) {
    firstError = { message: memberError.message };
  } else {
    for (const row of asRecordRows(memberData)) {
      const trip = asTripRow(
        row.trips as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | null
          | undefined,
      );
      if (trip) byId.set(String(trip.id), trip);
    }
  }

  // Owned trips (creator) — includes rows where membership backfill never ran.
  const { data: ownedData, error: ownedError } = await supabase
    .from("trips")
    .select(cols)
    .eq("user_id", userId)
    .limit(500);

  if (ownedError) {
    if (!firstError) firstError = { message: ownedError.message };
  } else {
    for (const row of asRecordRows(ownedData)) {
      if (row.id == null) continue;
      const id = String(row.id);
      if (!byId.has(id)) byId.set(id, row);
    }
  }

  // Best-effort: ensure creator has an organizer members row for owned trips.
  const missingOrganizer: string[] = [];
  for (const [id, trip] of byId) {
    if (String(trip.user_id ?? "") !== userId) continue;
    missingOrganizer.push(id);
  }
  if (missingOrganizer.length > 0) {
    const { data: existingMembers } = await supabase
      .from("members")
      .select("trip_id")
      .eq("user_id", userId)
      .in("trip_id", missingOrganizer);
    const have = new Set(
      (existingMembers ?? []).map((row) => String((row as { trip_id?: string }).trip_id ?? "")),
    );
    const toInsert = missingOrganizer.filter((id) => !have.has(id));
    if (toInsert.length > 0) {
      await supabase.from("members").insert(
        toInsert.map((tripId) => ({
          trip_id: tripId,
          user_id: userId,
          name: "Organizer",
          email: "",
          role: "organizer",
        })),
      );
    }
  }

  if (byId.size === 0 && firstError) {
    return { trips: [], tripIds: [], error: firstError };
  }

  const trips = sortTripsNewestFirst([...byId.values()]);
  const tripIds = trips.map((trip) => String(trip.id));
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
    .eq("user_id", userId)
    .limit(500);

  const ids = new Set<string>();
  if (!error && data?.length) {
    for (const row of data) {
      const tid = row.trip_id as string | undefined;
      if (tid) ids.add(String(tid));
    }
  }

  const { data: owned } = await supabase.from("trips").select("id").eq("user_id", userId).limit(500);
  for (const row of owned ?? []) {
    if (row.id != null) ids.add(String(row.id));
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

  if (memberRow) return true;

  const { data: owned } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  return !!owned;
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

  const { data: owned } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  return owned ? "organizer" : null;
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
