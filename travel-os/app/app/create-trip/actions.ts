"use server";

import { actionError, actionSuccess, type FormActionResult } from "@/lib/form-action-result";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTripAction(formData: FormData): Promise<FormActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const location = String(formData.get("location") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();

  if (!location || !startDate || !endDate) {
    return actionError("Please fill all fields.");
  }

  if (new Date(endDate) < new Date(startDate)) {
    return actionError("End date must be after start date.");
  }

  const { data: newTrip, error: insertError } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      location,
      start_date: startDate,
      end_date: endDate,
      title: location,
    })
    .select("id")
    .single();

  if (insertError || !newTrip?.id) {
    return actionError(insertError?.message || "Could not create trip.");
  }

  const tripId = String(newTrip.id);
  const organizerName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    (user.email?.split("@")[0] ?? "Organizer");

  const { error: memberError } = await supabase.from("members").insert({
    trip_id: tripId,
    user_id: user.id,
    name: organizerName,
    email: user.email ?? "",
    role: "organizer",
  });

  if (memberError) {
    await supabase.from("trips").delete().eq("id", tripId);
    return actionError(memberError.message || "Could not set up trip membership.");
  }

  revalidatePath("/app/trips");
  revalidatePath("/app/home");
  return actionSuccess("Trip created.", "/app/trips");
}
