import { SetAppHeader } from "@/components/AppHeader";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import { redirect } from "next/navigation";
import { pickFirstString, type TripRecord } from "@/app/app/_lib/trip-formatters";
import { selectPrimaryTrip } from "@/app/app/_lib/use-primary-trip";
import ForexClient from "@/app/app/forex/_components/ForexClient";
import type { TripForexOption } from "@/app/app/forex/_lib/types";

export default async function ForexPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const { trips: tripsRaw } = await fetchTripsViaMembership(supabase, user.id);
  const trips = (tripsRaw ?? []) as TripRecord[];
  const { tripId: primaryTripId } = selectPrimaryTrip(trips);
  const tripOptions: TripForexOption[] = trips
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
    .filter((trip): trip is TripForexOption => trip != null);

  const fallbackTrip: TripForexOption = {
    id: "local",
    title: "General travel",
    destination: "Your destination",
  };
  const finalTrips = tripOptions.length > 0 ? tripOptions : [fallbackTrip];
  const initialTripId =
    (primaryTripId && finalTrips.some((trip) => trip.id === primaryTripId) ? primaryTripId : null) ??
    finalTrips[0]!.id;

  return (
    <>
      <SetAppHeader title="Forex" showBack />
      <ForexClient trips={finalTrips} initialTripId={initialTripId} />
    </>
  );
}
