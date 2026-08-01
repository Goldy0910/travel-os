import type { SupabaseClient } from "@supabase/supabase-js";
import { extractYMD } from "@/lib/itinerary-trip-range";

export type DraftActivityRow = {
  date: string;
  title: string;
  time: string | null;
  location: string;
  notes: string | null;
};

export async function markItinerarySetupComplete(
  supabase: SupabaseClient,
  tripId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("trips")
    .update({ itinerary_setup_complete: true })
    .eq("id", tripId);
  if (error) return { ok: false, message: error.message || "Could not save itinerary progress." };
  return { ok: true };
}

export async function ensureItineraryDayId(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  date: string,
): Promise<string | number> {
  const { data: existingDay } = await supabase
    .from("itinerary_days")
    .select("id")
    .eq("trip_id", tripId)
    .eq("date", date)
    .maybeSingle();

  if (existingDay?.id) return existingDay.id;

  const { data: newDay, error: dayInsertError } = await supabase
    .from("itinerary_days")
    .insert({
      trip_id: tripId,
      user_id: userId,
      date,
    })
    .select("id")
    .single();

  if (dayInsertError || !newDay?.id) {
    throw new Error(dayInsertError?.message || "Could not create itinerary day");
  }
  return newDay.id;
}

function simplifyGeneratedActivityTitle(raw: string): string {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return "Activity";

  const [firstClause] = normalized.split(/\s[—\-|]\s|:\s+/);
  const base = (firstClause || normalized).trim();
  const compact = base.replace(/[.!,;:]+$/g, "").trim();
  if (compact.length <= 56) return compact;
  return `${compact.slice(0, 53).trimEnd()}...`;
}

/**
 * Replace itinerary items for the dates present in `rows` (same behavior as AI setup / PDF import).
 */
export async function replaceItineraryWithDraft(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  rows: DraftActivityRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const uniqueDates = Array.from(new Set(rows.map((r) => r.date)));

  const { data: existingDays } = await supabase
    .from("itinerary_days")
    .select("id, date")
    .eq("trip_id", tripId)
    .in("date", uniqueDates);
  const dayIdByDate = new Map<string, string | number>();
  for (const row of existingDays ?? []) {
    if (row.date != null && row.id != null) dayIdByDate.set(String(row.date), row.id);
  }

  for (const date of uniqueDates) {
    if (dayIdByDate.has(date)) continue;
    const dayId = await ensureItineraryDayId(supabase, tripId, userId, date);
    dayIdByDate.set(date, dayId);
  }

  await supabase.from("itinerary_items").delete().eq("trip_id", tripId).in("date", uniqueDates);

  const payload = rows.map((row) => {
    const title = simplifyGeneratedActivityTitle(row.title);
    return {
      trip_id: tripId,
      user_id: userId,
      itinerary_day_id: dayIdByDate.get(row.date) ?? null,
      date: row.date,
      activity_name: title,
      title,
      location: row.location || "Location TBD",
      time: row.time,
    };
  });

  const { error } = await supabase.from("itinerary_items").insert(payload);
  if (error) {
    throw new Error(error.message || "Could not save generated itinerary.");
  }
}

export function pickFirstTripDateValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return "";
}

export function normalizeTripDateInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const ymd = extractYMD(trimmed);
  if (ymd) return ymd;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
