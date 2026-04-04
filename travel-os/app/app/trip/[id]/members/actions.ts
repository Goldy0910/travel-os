"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMemberRole } from "@/lib/trip-membership";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export async function addTripMember(tripId: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email || !email.includes("@")) {
    redirect(
      `/app/trip/${tripId}/members?error=${encodeURIComponent("Enter a valid email address.")}`,
    );
  }

  const role = await getMemberRole(supabase, tripId, user.id);
  if (role !== "organizer") {
    redirect(
      `/app/trip/${tripId}/members?error=${encodeURIComponent("Only organizers can add members.")}`,
    );
  }

  const local = email.split("@")[0] || "Guest";
  const { error: insertError } = await supabase.from("members").insert({
    trip_id: tripId,
    user_id: null,
    email,
    name: local,
    role: "member",
  });

  if (insertError) {
    redirect(
      `/app/trip/${tripId}/members?error=${encodeURIComponent(
        insertError.message || "Could not add member.",
      )}`,
    );
  }

  revalidatePath(`/app/trip/${tripId}/members`);
  revalidatePath(`/app/trip/${tripId}`);
  redirect(`/app/trip/${tripId}/members?success=1`);
}
