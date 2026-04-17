import { SetAppHeader } from "@/components/AppHeader";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import { redirect } from "next/navigation";
import { pickFirstString, type TripRecord } from "@/app/app/_lib/trip-formatters";
import { selectPrimaryTrip } from "@/app/app/_lib/use-primary-trip";
import LocalAppsClient from "@/app/app/local-apps/_components/LocalAppsClient";
import type { LocalAppsTripOption } from "@/app/app/local-apps/_lib/types";

function extractYmd(raw: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return m?.[1] ?? "";
}

export default async function LocalAppsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const { trips: tripsRaw } = await fetchTripsViaMembership(supabase, user.id);
  const trips = (tripsRaw ?? []) as TripRecord[];
  const { tripId: primaryTripId } = selectPrimaryTrip(trips);
  const tripOptions: LocalAppsTripOption[] = trips
    .map((trip, index) => {
      const id =
        typeof trip.id === "string" || typeof trip.id === "number" ? String(trip.id) : "";
      if (!id) return null;
      return {
        id,
        title: pickFirstString(trip, ["title", "name", "trip_name"], `Trip ${index + 1}`),
        destination: pickFirstString(trip, ["destination", "location", "city", "place"], "Destination"),
        startDate: extractYmd(pickFirstString(trip, ["start_date", "startDate", "date_from"], "")),
        endDate: extractYmd(pickFirstString(trip, ["end_date", "endDate", "date_to"], "")),
      };
    })
    .filter((trip): trip is LocalAppsTripOption => trip != null);

  const fallbackTrip: LocalAppsTripOption = {
    id: "fallback",
    title: "Current trip",
    destination: "Singapore",
    startDate: "",
    endDate: "",
  };
  const finalTrips = tripOptions.length > 0 ? tripOptions : [fallbackTrip];
  const initialTripId =
    (primaryTripId && finalTrips.some((trip) => trip.id === primaryTripId) ? primaryTripId : null) ??
    finalTrips[0]!.id;

  return (
    <>
      <SetAppHeader title="Local Apps" showBack />
      <LocalAppsClient trips={finalTrips} initialTripId={initialTripId} />
    </>
  );
}
