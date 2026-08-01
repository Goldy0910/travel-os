import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureItineraryDayId } from "@/app/app/trip/[id]/_lib/itinerary-persist";
import { extractYMD } from "@/lib/itinerary-trip-range";
import type {
  ItineraryEditOp,
  ItineraryProposedEdit,
} from "@/lib/chat/itinerary-edit-types";

export type ExistingItineraryActivity = {
  id: string;
  title: string;
  location: string | null;
  time: string | null;
  date: string;
};

export type ApplyItineraryRevisionsResult = {
  added: number;
  updated: number;
  deleted: number;
  moved: number;
  appliedDays: string[];
  addedTitles: string[];
  updatedTitles: string[];
  deletedTitles: string[];
  movedTitles: string[];
};

function parseYmd(input: string): string {
  const v = input.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  if (m) return m[1]!;
  return extractYMD(v) ?? "";
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  const m12 = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(v);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2] ?? "0");
    const ap = m12[3];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
  }
  const m24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v);
  if (m24) return `${String(Number(m24[1])).padStart(2, "0")}:${m24[2]}`;
  return null;
}

function dayInRange(
  day: string,
  tripStartDate: string | null,
  tripEndDate: string | null,
): boolean {
  if (tripStartDate && day < tripStartDate) return false;
  if (tripEndDate && day > tripEndDate) return false;
  return true;
}

/**
 * Persist structured itinerary edits (add / update / delete / move).
 * Used by apply_itinerary_edits tool and confirmation apply routes.
 */
export async function applyItineraryProposedEdits(input: {
  supabase: SupabaseClient;
  tripId: string;
  userId: string;
  fallbackDate?: string | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  existingActivities: Map<string, ExistingItineraryActivity>;
  edits: ItineraryProposedEdit[];
}): Promise<ApplyItineraryRevisionsResult> {
  const result: ApplyItineraryRevisionsResult = {
    added: 0,
    updated: 0,
    deleted: 0,
    moved: 0,
    appliedDays: [],
    addedTitles: [],
    updatedTitles: [],
    deletedTitles: [],
    movedTitles: [],
  };
  const appliedDaySet = new Set<string>();
  const fallback = input.fallbackDate ? parseYmd(input.fallbackDate) : "";

  for (const raw of input.edits) {
    if (!raw || typeof raw !== "object") continue;
    const op: ItineraryEditOp = raw.op;
    const day = parseYmd(typeof raw.day === "string" ? raw.day : "") || fallback;
    if (!day) continue;
    if (!dayInRange(day, input.tripStartDate ?? null, input.tripEndDate ?? null)) continue;

    const activityId =
      typeof raw.activityId === "string" ? raw.activityId.trim() : "";
    const existing = activityId ? input.existingActivities.get(activityId) : undefined;
    const title =
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : existing?.title ?? "";
    const location =
      typeof raw.location === "string" && raw.location.trim()
        ? raw.location.trim()
        : null;
    const time = normalizeTime(raw.time);
    const toDayRaw =
      typeof raw.toDay === "string" ? parseYmd(raw.toDay) : "";
    const toDay = toDayRaw || day;

    if (op === "delete") {
      if (!existing) continue;
      const { error } = await input.supabase
        .from("itinerary_items")
        .delete()
        .eq("trip_id", input.tripId)
        .eq("id", activityId);
      if (!error) {
        result.deleted += 1;
        appliedDaySet.add(existing.date || day);
        result.deletedTitles.push(existing.title || title || "Activity");
        input.existingActivities.delete(activityId);
      }
      continue;
    }

    if (op === "move") {
      if (!existing) continue;
      if (!dayInRange(toDay, input.tripStartDate ?? null, input.tripEndDate ?? null)) {
        continue;
      }
      let dayId: string | number | null = null;
      try {
        dayId = await ensureItineraryDayId(
          input.supabase,
          input.tripId,
          input.userId,
          toDay,
        );
      } catch {
        continue;
      }
      const updates: Record<string, unknown> = {
        date: toDay,
        itinerary_day_id: dayId,
        user_modified: true,
      };
      if (title) {
        updates.title = title;
        updates.activity_name = title;
      }
      if (location) updates.location = location;
      if (time) updates.time = time;

      let { error } = await input.supabase
        .from("itinerary_items")
        .update(updates)
        .eq("trip_id", input.tripId)
        .eq("id", activityId);
      if (error) {
        const { user_modified: _um, ...fallbackUpdates } = updates;
        const fb = await input.supabase
          .from("itinerary_items")
          .update(fallbackUpdates)
          .eq("trip_id", input.tripId)
          .eq("id", activityId);
        error = fb.error;
      }
      if (!error) {
        result.moved += 1;
        appliedDaySet.add(existing.date || day);
        appliedDaySet.add(toDay);
        result.movedTitles.push(title || existing.title);
        input.existingActivities.set(activityId, {
          ...existing,
          date: toDay,
          title: title || existing.title,
          location: location ?? existing.location,
          time: time ?? existing.time,
        });
      }
      continue;
    }

    if (op === "update") {
      if (!existing) continue;
      const updates: Record<string, unknown> = { user_modified: true };
      if (title) {
        updates.title = title;
        updates.activity_name = title;
      }
      if (location) updates.location = location;
      if (time) updates.time = time;
      // Allow same-day time/location edits; treat toDay as optional day shift.
      if (toDayRaw && toDay !== existing.date) {
        if (!dayInRange(toDay, input.tripStartDate ?? null, input.tripEndDate ?? null)) {
          continue;
        }
        try {
          const dayId = await ensureItineraryDayId(
            input.supabase,
            input.tripId,
            input.userId,
            toDay,
          );
          updates.date = toDay;
          updates.itinerary_day_id = dayId;
        } catch {
          continue;
        }
      }

      if (Object.keys(updates).length <= 1) continue;

      let { error } = await input.supabase
        .from("itinerary_items")
        .update(updates)
        .eq("trip_id", input.tripId)
        .eq("id", activityId);
      if (error) {
        const { user_modified: _um, ...fallbackUpdates } = updates;
        const fb = await input.supabase
          .from("itinerary_items")
          .update(fallbackUpdates)
          .eq("trip_id", input.tripId)
          .eq("id", activityId);
        error = fb.error;
      }
      if (!error) {
        result.updated += 1;
        appliedDaySet.add(existing.date || day);
        if (typeof updates.date === "string") appliedDaySet.add(updates.date);
        result.updatedTitles.push(title || existing.title);
      }
      continue;
    }

    // add
    if (!title) continue;
    let dayId: string | number | null = null;
    try {
      dayId = await ensureItineraryDayId(
        input.supabase,
        input.tripId,
        input.userId,
        day,
      );
    } catch {
      continue;
    }

    const richInsert: Record<string, unknown> = {
      trip_id: input.tripId,
      user_id: input.userId,
      itinerary_day_id: dayId,
      date: day,
      activity_name: title,
      title,
      location: location || "Location TBD",
      time,
      ai_generated: true,
      user_modified: false,
    };
    let { error } = await input.supabase.from("itinerary_items").insert(richInsert);
    if (error) {
      const fallbackInsert = await input.supabase.from("itinerary_items").insert({
        trip_id: input.tripId,
        user_id: input.userId,
        itinerary_day_id: dayId,
        date: day,
        activity_name: title,
        title,
        location: location || "Location TBD",
        time,
      });
      error = fallbackInsert.error;
    }
    if (!error) {
      result.added += 1;
      appliedDaySet.add(day);
      result.addedTitles.push(title);
    }
  }

  result.appliedDays = Array.from(appliedDaySet);
  return result;
}

/** Convert legacy assistant ItineraryRevision rows into proposed edits. */
export function revisionsToProposedEdits(
  revisions: Array<{
    day: string;
    activityId?: string;
    title: string;
    location?: string | null;
    time?: string | null;
    state?: string | null;
    notes?: string | null;
  }>,
): ItineraryProposedEdit[] {
  const edits: ItineraryProposedEdit[] = [];
  for (const rev of revisions) {
    if (!rev || typeof rev !== "object") continue;
    const day = parseYmd(rev.day);
    if (!day) continue;
    const activityId =
      typeof rev.activityId === "string" ? rev.activityId.trim() : "";
    const title = typeof rev.title === "string" ? rev.title.trim() : "";
    const state = typeof rev.state === "string" ? rev.state : "planned";

    if (activityId && state === "skipped") {
      edits.push({
        op: "delete",
        day,
        activityId,
        title: title || undefined,
        label: title ? `Remove “${title}”` : "Remove activity",
      });
      continue;
    }

    if (activityId) {
      edits.push({
        op: "update",
        day,
        activityId,
        title: title || undefined,
        location: rev.location ?? null,
        time: rev.time ?? null,
        notes: rev.notes ?? null,
        label: title ? `Update “${title}”` : "Update activity",
      });
      continue;
    }

    if (!title) continue;
    edits.push({
      op: "add",
      day,
      title,
      location: rev.location ?? null,
      time: rev.time ?? null,
      notes: rev.notes ?? null,
      label: `Add “${title}”`,
    });
  }
  return edits;
}
