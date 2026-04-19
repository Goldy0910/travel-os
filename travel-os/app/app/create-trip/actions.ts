"use server";

import { actionError, actionSuccess, type FormActionResult } from "@/lib/form-action-result";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type StarterActivity = {
  dayOffset: number;
  time: string;
  title: string;
  location: string;
};

function normalizePlace(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function enumerateDateYmd(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function getManaliStarterActivities(): StarterActivity[] {
  return [
    { dayOffset: 0, time: "09:00", title: "Mall Road walk and cafe hopping", location: "Mall Road, Manali" },
    { dayOffset: 0, time: "16:30", title: "Hadimba Temple and Cedar Forest", location: "Hadimba Devi Temple" },
    { dayOffset: 1, time: "08:30", title: "Solang Valley adventure morning", location: "Solang Valley" },
    { dayOffset: 1, time: "18:00", title: "Old Manali food trail", location: "Old Manali" },
    { dayOffset: 2, time: "09:00", title: "Atal Tunnel + Sissu day trip", location: "Atal Tunnel / Sissu" },
    { dayOffset: 2, time: "19:00", title: "Riverside dinner", location: "Beas River side" },
    { dayOffset: 3, time: "10:00", title: "Naggar Castle and art museum", location: "Naggar" },
    { dayOffset: 3, time: "17:30", title: "Local market shopping", location: "Manu Market" },
  ];
}

async function seedManaliStarterItinerary(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tripId: string,
  userId: string,
  startDate: string,
  endDate: string,
) {
  const allDays = enumerateDateYmd(startDate, endDate);
  if (allDays.length === 0) return;

  const dayRows = allDays.map((date) => ({ trip_id: tripId, user_id: userId, date }));
  const { data: createdDays, error: daysInsertError } = await supabase
    .from("itinerary_days")
    .insert(dayRows)
    .select("id, date");
  if (daysInsertError) return;

  const dayIdByDate = new Map<string, string | number>();
  for (const row of createdDays ?? []) {
    if (row.date != null) {
      dayIdByDate.set(String(row.date), row.id);
    }
  }

  const templates = getManaliStarterActivities();
  const itemsToInsert = templates
    .map((t) => {
      const date = allDays[t.dayOffset];
      if (!date) return null;
      const dayId = dayIdByDate.get(date);
      if (!dayId) return null;
      return {
        trip_id: tripId,
        user_id: userId,
        itinerary_day_id: dayId,
        date,
        activity_name: t.title,
        title: t.title,
        location: t.location,
        time: t.time,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v != null);

  if (itemsToInsert.length > 0) {
    await supabase.from("itinerary_items").insert(itemsToInsert);
  }
}

export async function createTripAction(formData: FormData): Promise<FormActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const travelPlaceSlug = String(formData.get("travelPlaceSlug") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();

  if (!travelPlaceSlug || !startDate || !endDate) {
    return actionError("Choose a destination from the list and fill all fields.");
  }

  const { data: travelPlace, error: placeLookupError } = await supabase
    .from("travel_places")
    .select("canonical_location")
    .eq("slug", travelPlaceSlug)
    .maybeSingle();

  if (placeLookupError || !travelPlace?.canonical_location) {
    return actionError("Invalid destination. Please choose a place from the list.");
  }

  const location = String(travelPlace.canonical_location).trim();

  if (new Date(endDate) < new Date(startDate)) {
    return actionError("End date must be after start date.");
  }

  const normalizedLocation = normalizePlace(location);
  const seedManaliStarter = normalizedLocation.includes("manali");

  const { data: newTrip, error: insertError } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      location,
      start_date: startDate,
      end_date: endDate,
      title: location,
      /** Prompt on itinerary tab until user chooses AI / PDF / manual — except Manali starter itinerary. */
      itinerary_setup_complete: seedManaliStarter,
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

  if (seedManaliStarter) {
    await seedManaliStarterItinerary(supabase, tripId, user.id, startDate, endDate);
  }

  revalidatePath("/app/trips");
  revalidatePath("/app/home");
  return actionSuccess(
    "Trip created.",
    `/app/trip/${encodeURIComponent(tripId)}?tab=itinerary&setupItinerary=1`,
  );
}
