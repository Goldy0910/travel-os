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
import {
  computeExpenseSplit,
  type SplitType,
} from "@/app/app/trip/[id]/expenses/_lib/expense-split";
import {
  enumerateTripDates,
  extractPdfItineraryDraft,
  generateAiItineraryDraft,
} from "@/app/app/trip/[id]/_lib/itinerary-bootstrap-ai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DOCS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET || "trip-docs";

async function markItinerarySetupComplete(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tripId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("trips")
    .update({ itinerary_setup_complete: true })
    .eq("id", tripId);
  if (error) return { ok: false, message: error.message || "Could not save itinerary progress." };
  return { ok: true };
}

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

type DraftActivityRow = {
  date: string;
  title: string;
  time: string | null;
  location: string;
  notes: string | null;
};

function pickFirstTripDateValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return "";
}

function normalizeTripDateInput(raw: string): string {
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

function simplifyGeneratedActivityTitle(raw: string): string {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return "Activity";

  const [firstClause] = normalized.split(/\s[—\-|]\s|:\s+/);
  const base = (firstClause || normalized).trim();
  const compact = base.replace(/[.!,;:]+$/g, "").trim();
  if (compact.length <= 56) return compact;
  return `${compact.slice(0, 53).trimEnd()}...`;
}

async function replaceItineraryWithDraft(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tripId: string,
  userId: string,
  rows: DraftActivityRow[],
) {
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

  // Replace only the items for the dates touched by generated/parsed draft.
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

export async function generateAiItineraryAction(
  tripId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const ok = await isTripMember(supabase, tripId, user.id);
  if (!ok) redirect("/app/home");

  const interests = String(formData.get("interests") ?? "").trim();
  const budget = String(formData.get("budget") ?? "").trim();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  const row = (trip ?? {}) as Record<string, unknown>;
  const destination =
    String(row.destination ?? row.location ?? row.city ?? row.place ?? "").trim() || "Destination";
  const startDate = normalizeTripDateInput(
    pickFirstTripDateValue(row, ["start_date", "startDate", "date_from"]),
  );
  const endDate = normalizeTripDateInput(
    pickFirstTripDateValue(row, ["end_date", "endDate", "date_to"]),
  );
  const tripDates = enumerateTripDates(startDate, endDate);
  if (tripDates.length === 0) {
    return actionError("Trip dates are invalid. Please update trip dates first.");
  }

  try {
    const draft = await generateAiItineraryDraft({ destination, tripDates, interests, budget });
    if (draft.length === 0) {
      return actionError("AI generation failed. Please retry.");
    }
    await replaceItineraryWithDraft(supabase, tripId, user.id, draft);
  } catch (e) {
    const reason = e instanceof Error ? e.message.trim() : "";
    return actionError(reason ? `AI generation failed: ${reason}` : "AI generation failed. Please retry.");
  }

  const flagged = await markItinerarySetupComplete(supabase, tripId);
  if (!flagged.ok) return actionError(flagged.message);

  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath("/app/home");
  return actionSuccess("AI itinerary draft created.");
}

export async function importPdfItineraryAction(
  tripId: string,
  formData: FormData,
): Promise<FormActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const ok = await isTripMember(supabase, tripId, user.id);
  if (!ok) redirect("/app/home");

  const file = formData.get("itineraryPdf");
  if (!(file instanceof File) || file.size <= 0) {
    return actionError("Please upload a PDF file.");
  }
  if (file.type !== "application/pdf") {
    return actionError("Uploaded file must be a PDF.");
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  const row = (trip ?? {}) as Record<string, unknown>;
  const startDate = normalizeTripDateInput(
    pickFirstTripDateValue(row, ["start_date", "startDate", "date_from"]),
  );
  const endDate = normalizeTripDateInput(
    pickFirstTripDateValue(row, ["end_date", "endDate", "date_to"]),
  );
  const tripDates = enumerateTripDates(startDate, endDate);
  if (tripDates.length === 0) {
    return actionError("Trip dates are invalid. Please update trip dates first.");
  }

  try {
    const arr = new Uint8Array(await file.arrayBuffer());
    const pdfBase64 = Buffer.from(arr).toString("base64");

    const draft = await extractPdfItineraryDraft({ pdfBase64, tripDates });
    if (draft.length === 0) {
      return actionError("Couldn't extract itinerary clearly. Please review or add manually.");
    }
    await replaceItineraryWithDraft(supabase, tripId, user.id, draft);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      const reason = e instanceof Error ? e.message : "Unknown extraction error";
      return actionError(
        `Couldn't extract itinerary clearly. Please review or add manually. (${reason})`,
      );
    }
    return actionError("Couldn't extract itinerary clearly. Please review or add manually.");
  }

  const flagged = await markItinerarySetupComplete(supabase, tripId);
  if (!flagged.ok) return actionError(flagged.message);

  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath("/app/home");
  return actionSuccess("PDF itinerary imported.");
}

export async function completeItinerarySetupManualAction(tripId: string): Promise<FormActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const ok = await isTripMember(supabase, tripId, user.id);
  if (!ok) redirect("/app/home");

  const flagged = await markItinerarySetupComplete(supabase, tripId);
  if (!flagged.ok) return actionError(flagged.message);

  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath("/app/home");
  return actionSuccess("Add your first activity when you're ready.");
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

  revalidatePath(`/app/trip/${tripId}`);
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
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const paidBy = String(formData.get("paidBy") ?? "").trim();
  const splitType = String(formData.get("splitType") ?? "").trim() as SplitType;
  const date = String(formData.get("date") ?? "").trim();
  const includePayerRaw = String(formData.get("includePayer") ?? "").trim();
  const participantIdsRaw = String(formData.get("participantIdsJson") ?? "[]");
  const exactAmountsRaw = String(formData.get("exactAmountsJson") ?? "{}");
  const percentageRaw = String(formData.get("percentagesJson") ?? "{}");

  if (!Number.isFinite(amount) || amount <= 0 || !paidBy || !splitType || !date) {
    return actionError("Please fill all fields correctly.");
  }
  if (!["equal", "exact", "percentage", "none"].includes(splitType)) {
    return actionError("Invalid split type.");
  }

  const ok = await isTripMember(supabase, tripId, user.id);
  if (!ok) redirect("/app/home");

  let participantIds: string[] = [];
  let exactAmounts: Record<string, number> = {};
  let percentages: Record<string, number> = {};
  try {
    const parsedIds = JSON.parse(participantIdsRaw);
    participantIds = Array.isArray(parsedIds) ? parsedIds.map((v) => String(v)) : [];
  } catch {
    participantIds = [];
  }
  try {
    const parsedExact = JSON.parse(exactAmountsRaw) as Record<string, unknown>;
    exactAmounts = Object.fromEntries(
      Object.entries(parsedExact ?? {}).map(([k, v]) => [k, Number(v ?? 0)]),
    );
  } catch {
    exactAmounts = {};
  }
  try {
    const parsedPct = JSON.parse(percentageRaw) as Record<string, unknown>;
    percentages = Object.fromEntries(
      Object.entries(parsedPct ?? {}).map(([k, v]) => [k, Number(v ?? 0)]),
    );
  } catch {
    percentages = {};
  }

  const split = computeExpenseSplit({
    amount,
    splitType,
    paidByUserId: paidBy,
    selectedParticipantIds: participantIds,
    includePayerInEqual: includePayerRaw !== "false",
    exactAmountsByUserId: exactAmounts,
    percentagesByUserId: percentages,
  });
  if (split.errors.length > 0) {
    return actionError(split.errors[0] ?? "Invalid split values.");
  }

  const payload = {
    title: title || description || "Expense",
    description: description || null,
    amount,
    paid_by: paidBy,
    paid_by_user_id: paidBy,
    split_type: splitType,
    date,
    total_amount: amount,
    payer: paidBy,
    created_by: user.id,
  };

  const participantRows = split.rows.map((row) => ({
    user_id: row.userId,
    split_value: row.splitValue,
    split_type: row.splitType,
    computed_amount: row.computedAmount,
    owes_amount: row.owesAmount,
  }));

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
    await supabase.from("expense_participants").delete().eq("expense_id", expenseIdRaw);
    if (participantRows.length > 0) {
      const { error: participantsError } = await supabase
        .from("expense_participants")
        .insert(
          participantRows.map((row) => ({
            expense_id: expenseIdRaw,
            ...row,
          })),
        );
      if (participantsError) {
        return actionError(participantsError.message || "Could not update split details.");
      }
    }
  } else {
    const { data: insertedExpense, error: insertError } = await supabase.from("expenses").insert({
      ...payload,
      trip_id: tripId,
      user_id: user.id,
    }).select("id").single();

    if (insertError || !insertedExpense?.id) {
      return actionError(insertError?.message || "Could not add expense.");
    }
    if (participantRows.length > 0) {
      const { error: participantsError } = await supabase
        .from("expense_participants")
        .insert(
          participantRows.map((row) => ({
            expense_id: String(insertedExpense.id),
            ...row,
          })),
        );
      if (participantsError) {
        return actionError(participantsError.message || "Could not save split details.");
      }
    }
    await insertTripActivityLog(supabase, {
      tripId,
      userId: user.id,
      action: formatExpenseAddedAction(actorDisplayName(user), title || description || "Expense"),
    });
  }

  revalidatePath(`/app/trip/${tripId}`);
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

  revalidatePath(`/app/trip/${tripId}`);
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
    .select("user_id, email, role")
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

  const baseDelete = supabase.from("members").delete().eq("trip_id", tripId);
  let deleteError: { message: string } | null = null;
  if (row.user_id != null) {
    const { error } = await baseDelete.eq("user_id", row.user_id);
    deleteError = error;
  } else if (typeof row.email === "string" && row.email.trim().length > 0) {
    const { error } = await baseDelete.eq("email", row.email.trim());
    deleteError = error;
  } else {
    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", memberRowId)
      .eq("trip_id", tripId);
    deleteError = error;
  }

  if (deleteError) {
    return actionError(deleteError.message || "Could not remove member.");
  }

  revalidatePath(`/app/trip/${tripId}/members`);
  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath("/app/trips");
  revalidatePath("/app/home");
  revalidatePath("/app/docs");
  revalidatePath("/app/expenses");
  revalidatePath("/app/members");
  return actionSuccess("Member removed.");
}
