import type { SupabaseClient } from "@supabase/supabase-js";

export function extractYMD(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return m?.[1] ?? null;
}

type ItemRow = {
  id: string | number;
  date: string | null;
  itinerary_day_id: string | number | null;
};

type DayRow = { id: string | number; date: string | null };

function dayDateMap(days: DayRow[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const d of days) {
    const ymd = d.date ? extractYMD(String(d.date)) ?? String(d.date).trim().slice(0, 10) : null;
    if (ymd) m.set(String(d.id), ymd);
  }
  return m;
}

function resolveItemYmd(item: ItemRow, dayDates: Map<string, string>): string | null {
  if (item.date && String(item.date).trim()) {
    return extractYMD(String(item.date)) ?? String(item.date).trim().slice(0, 10);
  }
  if (item.itinerary_day_id != null) {
    return dayDates.get(String(item.itinerary_day_id)) ?? null;
  }
  return null;
}

function isOutOfRange(ymd: string, start: string, end: string): boolean {
  return ymd < start || ymd > end;
}

/**
 * Removes itinerary_days and itinerary_items (and activity comments) whose calendar day
 * falls outside [ymdStart, ymdEnd] (inclusive), for the given trip.
 */
export async function pruneItineraryOutsideTripRange(
  supabase: SupabaseClient,
  tripId: string,
  ymdStart: string,
  ymdEnd: string,
): Promise<void> {
  if (!ymdStart || !ymdEnd || ymdStart > ymdEnd) return;

  const [{ data: daysData }, { data: itemsData }] = await Promise.all([
    supabase.from("itinerary_days").select("id, date").eq("trip_id", tripId),
    supabase.from("itinerary_items").select("id, date, itinerary_day_id").eq("trip_id", tripId),
  ]);

  const days = (daysData ?? []) as DayRow[];
  const items = (itemsData ?? []) as ItemRow[];
  const dayDates = dayDateMap(days);

  const badDayIds = days
    .filter((d) => {
      const y = d.date ? extractYMD(String(d.date)) ?? String(d.date).trim().slice(0, 10) : null;
      return y != null && isOutOfRange(y, ymdStart, ymdEnd);
    })
    .map((d) => String(d.id));

  const badItemIds = new Set<string>();
  for (const item of items) {
    const ymd = resolveItemYmd(item, dayDates);
    if (ymd && isOutOfRange(ymd, ymdStart, ymdEnd)) {
      badItemIds.add(String(item.id));
    }
    if (!ymd && item.itinerary_day_id != null && badDayIds.includes(String(item.itinerary_day_id))) {
      badItemIds.add(String(item.id));
    }
  }

  const itemIds = [...badItemIds];
  if (itemIds.length > 0) {
    await supabase
      .from("comments")
      .delete()
      .eq("trip_id", tripId)
      .eq("entity_type", "activity")
      .in("entity_id", itemIds);

    await supabase.from("itinerary_items").delete().eq("trip_id", tripId).in("id", itemIds);
  }

  if (badDayIds.length > 0) {
    await supabase.from("itinerary_days").delete().eq("trip_id", tripId).in("id", badDayIds);
  }
}
