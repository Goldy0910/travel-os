import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import type { ToolContext, ToolFailure } from "@/lib/tools/types";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { extractYMD } from "@/lib/itinerary-trip-range";
import type { ExistingItineraryActivity } from "@/lib/ai/apply-itinerary-revisions";

export type ItineraryToolAuth = {
  supabase: SupabaseClient;
  user: User;
  tripId: string;
};

export async function requireItineraryToolAuth(
  tripIdRaw: string | undefined,
  ctx: ToolContext,
): Promise<ItineraryToolAuth | ToolFailure> {
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

  return { supabase, user, tripId };
}

export function isToolFailure(value: unknown): value is ToolFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ToolFailure).ok === false &&
    typeof (value as ToolFailure).error === "string"
  );
}

export type TripItinerarySnapshot = {
  tripStartDate: string | null;
  tripEndDate: string | null;
  activities: ExistingItineraryActivity[];
  activityMap: Map<string, ExistingItineraryActivity>;
};

export async function loadTripItinerarySnapshot(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripItinerarySnapshot> {
  const { data: trip } = await supabase
    .from("trips")
    .select("start_date, end_date, date_from, date_to")
    .eq("id", tripId)
    .maybeSingle();

  const tripRow = (trip ?? {}) as Record<string, unknown>;
  const startRaw =
    (typeof tripRow.start_date === "string" && tripRow.start_date) ||
    (typeof tripRow.date_from === "string" && tripRow.date_from) ||
    "";
  const endRaw =
    (typeof tripRow.end_date === "string" && tripRow.end_date) ||
    (typeof tripRow.date_to === "string" && tripRow.date_to) ||
    "";
  const tripStartDate = extractYMD(startRaw) || (startRaw.trim().slice(0, 10) || null);
  const tripEndDate = extractYMD(endRaw) || (endRaw.trim().slice(0, 10) || null);

  const richSelect =
    "id, title, activity_name, location, time, date, itinerary_day_id";
  const fallbackSelect = "id, title, activity_name, location, time, date, itinerary_day_id";

  let { data: items, error } = await supabase
    .from("itinerary_items")
    .select(richSelect)
    .eq("trip_id", tripId)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    const fallback = await supabase
      .from("itinerary_items")
      .select(fallbackSelect)
      .eq("trip_id", tripId)
      .order("date", { ascending: true })
      .order("time", { ascending: true });
    items = fallback.data;
  }

  const dayIds = Array.from(
    new Set(
      (items ?? [])
        .map((r) =>
          r.itinerary_day_id != null ? String(r.itinerary_day_id) : "",
        )
        .filter(Boolean),
    ),
  );
  const dayDateById = new Map<string, string>();
  if (dayIds.length > 0) {
    const { data: days } = await supabase
      .from("itinerary_days")
      .select("id, date")
      .eq("trip_id", tripId)
      .in("id", dayIds);
    for (const d of days ?? []) {
      if (d.id != null && d.date != null) {
        const ymd = extractYMD(String(d.date)) ?? String(d.date).slice(0, 10);
        dayDateById.set(String(d.id), ymd);
      }
    }
  }

  const activities: ExistingItineraryActivity[] = [];
  for (const row of items ?? []) {
    const id = String(row.id ?? "");
    if (!id) continue;
    let date =
      typeof row.date === "string"
        ? extractYMD(row.date) ?? row.date.slice(0, 10)
        : "";
    if (!date && row.itinerary_day_id != null) {
      date = dayDateById.get(String(row.itinerary_day_id)) ?? "";
    }
    activities.push({
      id,
      title: String(row.title ?? row.activity_name ?? "Activity"),
      location: typeof row.location === "string" ? row.location : null,
      time: typeof row.time === "string" ? row.time : null,
      date,
    });
  }

  const activityMap = new Map(activities.map((a) => [a.id, a]));
  return { tripStartDate, tripEndDate, activities, activityMap };
}
