"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  actorDisplayName,
  formatExpenseAddedAction,
  formatItineraryActivityAddedAction,
  insertTripActivityLog,
} from "@/lib/activity-log";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMemberRole, isTripMember } from "@/lib/trip-membership";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DOCS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET || "trip-docs";

function errRedirect(tripId: string, msg: string) {
  redirect(`/app/trip/${tripId}?error=${encodeURIComponent(msg)}`);
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

export async function saveItineraryActivityAction(tripId: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const itemIdRaw = String(formData.get("itemId") ?? "").trim();
  const activityName = String(formData.get("activityName") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();

  if (!activityName || !location || !time || !date) {
    errRedirect(tripId, "Please fill all fields");
  }

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) redirect("/app/home");

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
        errRedirect(tripId, "Activity not found");
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
        errRedirect(tripId, updateError.message || "Could not update activity");
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
        errRedirect(tripId, itemInsertError.message || "Could not add activity");
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
    errRedirect(tripId, e instanceof Error ? e.message : "Could not save activity");
  }

  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath("/app/home");
  redirect(`/app/trip/${tripId}`);
}

export async function updateTripDetailsAction(tripId: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const role = await getMemberRole(supabase, tripId, user.id);
  if (role !== "organizer") {
    errRedirect(tripId, "Only organizers can update trip details.");
  }

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();

  if (!title || !location || !startDate || !endDate) {
    errRedirect(tripId, "Please fill all trip fields.");
  }

  if (new Date(endDate) < new Date(startDate)) {
    errRedirect(tripId, "End date must be on or after start date.");
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
    errRedirect(tripId, error.message || "Could not update trip.");
  }

  revalidatePath(`/app/trip/${tripId}`);
  revalidatePath("/app/home");
  revalidatePath("/app/trips");
  redirect(`/app/trip/${tripId}`);
}

export async function deleteTripAction(tripId: string, _formData: FormData) {
  void _formData;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const role = await getMemberRole(supabase, tripId, user.id);
  if (role !== "organizer") {
    errRedirect(tripId, "Only organizers can delete a trip.");
  }

  await supabase.from("documents").delete().eq("trip_id", tripId);
  await supabase.from("expenses").delete().eq("trip_id", tripId);
  await supabase.from("itinerary_items").delete().eq("trip_id", tripId);
  await supabase.from("itinerary_days").delete().eq("trip_id", tripId);
  await supabase.from("members").delete().eq("trip_id", tripId);

  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  if (error) {
    errRedirect(tripId, error.message || "Could not delete trip.");
  }

  revalidatePath("/app/trips");
  revalidatePath("/app/home");
  redirect("/app/trips");
}

export async function deleteItineraryItemAction(
  tripId: string,
  itemId: string,
  _formData: FormData,
) {
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
    errRedirect(tripId, error.message || "Could not delete activity.");
  }

  revalidatePath(`/app/trip/${tripId}`);
  redirect(`/app/trip/${tripId}`);
}

export async function deleteExpenseAction(
  tripId: string,
  expenseId: string,
  _formData: FormData,
) {
  void _formData;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const ok = await isTripMember(supabase, tripId, user.id);
  if (!ok) redirect("/app/home");

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("trip_id", tripId);

  if (error) {
    redirect(
      `/app/trip/${tripId}/expenses?error=${encodeURIComponent(error.message || "Could not delete expense.")}`,
    );
  }

  revalidatePath(`/app/trip/${tripId}/expenses`);
  redirect(`/app/trip/${tripId}/expenses`);
}

export async function saveExpenseAction(tripId: string, formData: FormData) {
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
    redirect(
      `/app/trip/${tripId}/expenses?error=${encodeURIComponent("Please fill all fields correctly.")}`,
    );
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
    const { error } = await supabase
      .from("expenses")
      .update(payload)
      .eq("id", expenseIdRaw)
      .eq("trip_id", tripId);

    if (error) {
      redirect(
        `/app/trip/${tripId}/expenses?error=${encodeURIComponent(
          error.message || "Could not update expense.",
        )}`,
      );
    }
  } else {
    const { error: insertError } = await supabase.from("expenses").insert({
      ...payload,
      trip_id: tripId,
      user_id: user.id,
    });

    if (insertError) {
      redirect(
        `/app/trip/${tripId}/expenses?error=${encodeURIComponent(
          insertError.message || "Could not add expense.",
        )}`,
      );
    }
    await insertTripActivityLog(supabase, {
      tripId,
      userId: user.id,
      action: formatExpenseAddedAction(actorDisplayName(user), title),
    });
  }

  revalidatePath(`/app/trip/${tripId}/expenses`);
  revalidatePath("/app/home");
  redirect(`/app/trip/${tripId}/expenses`);
}

export async function deleteDocumentAction(
  tripId: string,
  documentId: string,
  _formData: FormData,
) {
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
    redirect(
      `/app/trip/${tripId}/docs?error=${encodeURIComponent(error.message || "Could not delete document.")}`,
    );
  }

  revalidatePath(`/app/trip/${tripId}/docs`);
  redirect(`/app/trip/${tripId}/docs`);
}

export async function deleteMemberAction(
  tripId: string,
  memberRowId: string,
  _formData: FormData,
) {
  void _formData;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const role = await getMemberRole(supabase, tripId, user.id);
  if (role !== "organizer") {
    redirect(
      `/app/trip/${tripId}/members?error=${encodeURIComponent("Only organizers can remove members.")}`,
    );
  }

  const { data: row } = await supabase
    .from("members")
    .select("user_id, role")
    .eq("id", memberRowId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (!row) {
    redirect(
      `/app/trip/${tripId}/members?error=${encodeURIComponent("Member not found.")}`,
    );
  }

  if (row.role === "organizer") {
    const { count, error: cErr } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .eq("role", "organizer");

    if (!cErr && (count ?? 0) <= 1) {
      redirect(
        `/app/trip/${tripId}/members?error=${encodeURIComponent(
          "This trip must keep at least one organizer. Add another organizer first.",
        )}`,
      );
    }
  }

  const { error } = await supabase
    .from("members")
    .delete()
    .eq("id", memberRowId)
    .eq("trip_id", tripId);

  if (error) {
    redirect(
      `/app/trip/${tripId}/members?error=${encodeURIComponent(error.message || "Could not remove member.")}`,
    );
  }

  revalidatePath(`/app/trip/${tripId}/members`);
  revalidatePath(`/app/trip/${tripId}`);
  redirect(`/app/trip/${tripId}/members`);
}
