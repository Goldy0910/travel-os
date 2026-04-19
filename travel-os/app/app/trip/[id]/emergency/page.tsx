import { pickFirstString, type TripRecord } from "@/app/app/_lib/trip-formatters";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { redirect } from "next/navigation";

import EmergencyClient from "./_components/EmergencyClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function TripEmergencyPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const member = await isTripMember(supabase, id, user.id);
  if (!member) {
    redirect("/app/home");
  }

  const { data: tripData, error } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();

  if (error || !tripData) {
    redirect("/app/home");
  }

  const trip = tripData as TripRecord;
  const destination = pickFirstString(trip, ["place", "location", "destination", "city"], "");
  const title = pickFirstString(trip, ["title", "name", "trip_name"], "Trip");

  return (
    <EmergencyClient tripId={String(trip.id ?? id)} tripTitle={title} destination={destination} />
  );
}
