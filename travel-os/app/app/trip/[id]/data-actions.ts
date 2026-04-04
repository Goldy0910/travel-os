"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  actorDisplayName,
  formatExpenseAddedAction,
  formatItineraryActivityAddedAction,
  insertTripActivityLog,
} from "@/lib/activity-log";
import { actionError, actionSuccess, type FormActionResult } from "@/lib/form-action-result";
import { extractYMD, pruneItineraryOutsideTripRange } from "@/lib/itinerary-trip-range";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMemberRole, isTripMember } from "@/lib/trip-membership";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DOCS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET || "trip-docs";

async function canMutateExpense(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tripId: string,
  userId: string,
  expenseUserId: string | null,
): Promise<boolean> {
  const role = await getMemberRole(supabase, tripId, userId);
  if (role === "organizer") return true;
  if (expenseUserId != null && expenseUserId === userId) return true;
  return false;
}

async function ensureItineraryDayId(
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

export async function saveItineraryActivityAction(
  tripId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const itemIdRaw = String(formData.get("itemId") ?? "").trim();
  const activityName = String(formData.get("activityName") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const timeRaw = String(formData.get("time") ?? "").trim();
  const time = timeRaw.length > 0 ? timeRaw : null;
  const date = String(formData.get("date") ?? "").trim();

  if (!activityName || !location || !date) {
    return actionError("Please fill activity name, location, and date.");
  }

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) redirect("/app/home");

  const { data: tripRow } = await supabase
    .from("trips")
    .select("start_date, end_date")
    .eq("id", tripId)
    .maybeSingle();

  const tr = (tripRow ?? {}) as Record<string, string | null>;
  const tripStart = extractYMD(String(tr.start_date ?? "")) ?? "";
  const tripEnd = extractYMD(String(tr.end_date ?? "")) ?? "";
  const dateYmd = extractYMD(date) ?? date.trim().slice(0, 10);
  if (tripStart && tripEnd && (dateYmd < tripStart || dateYmd > tripEnd)) {
    return actionError("Activity date must be within the trip start and end dates.");
  }

  try {
    const dayId = await ensureItineraryDayId(supabase, tripId, user.id, date);

    if (itemIdRaw) {
      const { data: existing } = await supabase
        .from("itinerary_items")
        .select("id")
        .eq("id", itemIdRaw)
        .eq("trip_id", tripId)
        .maybeSingle();

      if (!existing?.id) {
        return actionError("Activity not found.");
      }

      const { error: updateError } = await supabase
        .from("itinerary_items")
        .update({
          itinerary_day_id: dayId,
          date,
          activity_name: activityName,
          location,
          time,
          title: activityName,
        })
        .eq("id", itemIdRaw)
        .eq("trip_id", tripId);

      if (updateError) {
        return actionError(updateError.message || "Could not update activity.");
      }
    } else {
      const { error: itemInsertError } = await supabase.from("itinerary_items").insert({
        trip_id: tripId,
        user_id: user.id,
        itinerary_day_id: dayId,
        date,
        activity_name: activityName,
        location,
        time,
        title: activityName,
      });

      if (itemInsertError) {
        return actionError(itemInsertError.message || "Could not add activity.");
      }
      await insertTripActivityLog(supabase, {
        tripId,
        userId: user.id,
        action: formatItineraryActivityAddedAction(
          actorDisplayName(user),
          activityName,
        ),
      });
    }
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Could not save activity.");
  }

  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath("/app/home");
  return actionSuccess(
    itemIdRaw ? "Activity updated." : "Activity added.",
  );
}

export async function updateTripDetailsAction(
  tripId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const role = await getMemberRole(supabase, tripId, user.id);
  if (role !== "organizer") {
    return actionError("Only organizers can update trip details.");
  }

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();

  if (!title || !location || !startDate || !endDate) {
    return actionError("Please fill all trip fields.");
  }

  if (new Date(endDate) < new Date(startDate)) {
    return actionError("End date must be on or after start date.");
  }

  const { error } = await supabase
    .from("trips")
    .update({
      title,
      location,
      start_date: startDate,
      end_date: endDate,
    })
    .eq("id", tripId);

  if (error) {
    return actionError(error.message || "Could not update trip.");
  }

  try {
    await pruneItineraryOutsideTripRange(supabase, tripId, startDate, endDate);
  } catch {
    /* non-fatal */
  }

  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath("/app/home");
  revalidatePath("/app/trips");
  return actionSuccess("Trip details updated.");
}

export async function deleteTripAction(
  tripId: string,
  _formData: FormData,
): Promise<FormActionResult> {
  void _formData;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const role = await getMemberRole(supabase, tripId, user.id);
  if (role !== "organizer") {
    return actionError("Only organizers can delete a trip.");
  }

  await supabase.from("documents").delete().eq("trip_id", tripId);
  await supabase.from("expenses").delete().eq("trip_id", tripId);
  await supabase.from("itinerary_items").delete().eq("trip_id", tripId);
  await supabase.from("itinerary_days").delete().eq("trip_id", tripId);
  await supabase.from("members").delete().eq("trip_id", tripId);

  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  if (error) {
    return actionError(error.message || "Could not delete trip.");
  }

  revalidatePath("/app/trips");
  revalidatePath("/app/home");
  return actionSuccess("Trip deleted.", "/app/trips");
}

export async function deleteItineraryItemAction(
  tripId: string,
  itemId: string,
  _formData: FormData,
): Promise<FormActionResult> {
  void _formData;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const ok = await isTripMember(supabase, tripId, user.id);
  if (!ok) redirect("/app/home");

  const { error } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", itemId)
    .eq("trip_id", tripId);

  if (error) {
    return actionError(error.message || "Could not delete activity.");
  }

  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath("/app/home");
  return actionSuccess("Activity removed.");
}

export async function deleteExpenseAction(
  tripId: string,
  expenseId: string,
  _formData: FormData,
): Promise<FormActionResult> {
  void _formData;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const ok = await isTripMember(supabase, tripId, user.id);
  if (!ok) redirect("/app/home");

  const { data: existing } = await supabase
    .from("expenses")
    .select("user_id")
    .eq("id", expenseId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (!existing) {
    return actionError("Expense not found.");
  }

  const creatorId =
    existing.user_id != null && String(existing.user_id).length > 0
      ? String(existing.user_id)
      : null;
  if (!(await canMutateExpense(supabase, tripId, user.id, creatorId))) {
    return actionError("Only the person who added this expense or an organiser can delete it.");
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("trip_id", tripId);

  if (error) {
    return actionError(error.message || "Could not delete expense.");
  }

  revalidatePath(`/app/trip/${tripId}/expenses`);
  revalidatePath("/app/home");
  return actionSuccess("Expense deleted.");
}

export async function saveExpenseAction(
  tripId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const expenseIdRaw = String(formData.get("expenseId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const paidBy = String(formData.get("paidBy") ?? "").trim();
  const splitType = String(formData.get("splitType") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();

  if (!title || !Number.isFinite(amount) || amount <= 0 || !paidBy || !splitType || !date) {
    return actionError("Please fill all fields correctly.");
  }

  const ok = await isTripMember(supabase, tripId, user.id);
  if (!ok) redirect("/app/home");

  const payload = {
    title,
    amount,
    paid_by: paidBy,
    split_type: splitType,
    date,
    total_amount: amount,
    payer: paidBy,
  };

  if (expenseIdRaw) {
    const { data: existing } = await supabase
      .from("expenses")
      .select("user_id")
      .eq("id", expenseIdRaw)
      .eq("trip_id", tripId)
      .maybeSingle();

    if (!existing) {
      return actionError("Expense not found.");
    }

    const creatorId =
      existing.user_id != null && String(existing.user_id).length > 0
        ? String(existing.user_id)
        : null;
    if (!(await canMutateExpense(supabase, tripId, user.id, creatorId))) {
      return actionError("Only the person who added this expense or an organiser can edit it.");
    }

    const { error } = await supabase
      .from("expenses")
      .update(payload)
      .eq("id", expenseIdRaw)
      .eq("trip_id", tripId);

    if (error) {
      return actionError(error.message || "Could not update expense.");
    }
  } else {
    const { error: insertError } = await supabase.from("expenses").insert({
      ...payload,
      trip_id: tripId,
      user_id: user.id,
    });

    if (insertError) {
      return actionError(insertError.message || "Could not add expense.");
    }
    await insertTripActivityLog(supabase, {
      tripId,
      userId: user.id,
      action: formatExpenseAddedAction(actorDisplayName(user), title),
    });
  }

  revalidatePath(`/app/trip/${tripId}/expenses`);
  revalidatePath("/app/home");
  return actionSuccess(expenseIdRaw ? "Expense updated." : "Expense added.");
}

export async function deleteDocumentAction(
  tripId: string,
  documentId: string,
  _formData: FormData,
): Promise<FormActionResult> {
  void _formData;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const ok = await isTripMember(supabase, tripId, user.id);
  if (!ok) redirect("/app/home");

  const { data: doc } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", documentId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (doc?.file_url && typeof doc.file_url === "string") {
    const marker = `/object/public/${DOCS_BUCKET}/`;
    const idx = doc.file_url.indexOf(marker);
    if (idx >= 0) {
      const path = doc.file_url.slice(idx + marker.length).split("?")[0];
      if (path) {
        try {
          await supabase.storage
            .from(DOCS_BUCKET)
            .remove([decodeURIComponent(path)]);
        } catch {
          /* still remove DB row */
        }
      }
    }
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("trip_id", tripId);

  if (error) {
    return actionError(error.message || "Could not delete document.");
  }

  revalidatePath(`/app/trip/${tripId}/docs`);
  revalidatePath("/app/home");
  return actionSuccess("Document removed.");
}

export async function deleteMemberAction(
  tripId: string,
  memberRowId: string,
  _formData: FormData,
): Promise<FormActionResult> {
  void _formData;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const role = await getMemberRole(supabase, tripId, user.id);
  if (role !== "organizer") {
    return actionError("Only organizers can remove members.");
  }

  const { data: row } = await supabase
    .from("members")
    .select("user_id, role")
    .eq("id", memberRowId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (!row) {
    return actionError("Member not found.");
  }

  if (row.role === "organizer") {
    const { count, error: cErr } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .eq("role", "organizer");

    if (!cErr && (count ?? 0) <= 1) {
      return actionError(
        "This trip must keep at least one organizer. Add another organizer first.",
      );
    }
  }

  const { error } = await supabase
    .from("members")
    .delete()
    .eq("id", memberRowId)
    .eq("trip_id", tripId);

  if (error) {
    return actionError(error.message || "Could not remove member.");
  }

  revalidatePath(`/app/trip/${tripId}/members`);
  revalidatePath(`/app/trip/${tripId}`);
  return actionSuccess("Member removed.");
}
