import { SetAppHeader } from "@/components/AppHeader";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import { redirect } from "next/navigation";
import { pickFirstString, type TripRecord } from "@/app/app/_lib/trip-formatters";
import { selectPrimaryTrip } from "@/app/app/_lib/use-primary-trip";
import EsimClient from "@/app/app/esim/_components/EsimClient";
import type { EsimTripOption } from "@/app/app/esim/_lib/types";

export default async function EsimPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const { trips: tripsRaw } = await fetchTripsViaMembership(supabase, user.id);
  const trips = (tripsRaw ?? []) as TripRecord[];
  const { tripId: primaryTripId } = selectPrimaryTrip(trips);

  const tripOptions: EsimTripOption[] = trips
    .map((trip, index) => {
      const id =
        typeof trip.id === "string" || typeof trip.id === "number" ? String(trip.id) : "";
      if (!id) return null;
      return {
        id,
        title: pickFirstString(trip, ["title", "name", "trip_name"], `Trip ${index + 1}`),
        destination: pickFirstString(trip, ["destination", "location", "city", "place"], "Destination"),
      };
    })
    .filter((trip): trip is EsimTripOption => trip != null);

  const fallbackTrip: EsimTripOption = {
    id: "fallback",
    title: "Current trip",
    destination: "Destination",
  };
  const finalTrips = tripOptions.length > 0 ? tripOptions : [fallbackTrip];
  const initialTripId =
    (primaryTripId && finalTrips.some((trip) => trip.id === primaryTripId) ? primaryTripId : null) ??
    finalTrips[0]!.id;

  return (
    <>
      <SetAppHeader title="eSIM" showBack />
      <EsimClient trips={finalTrips} initialTripId={initialTripId} />
    </>
  );
}
