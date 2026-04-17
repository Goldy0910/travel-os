import VisaPage from "@/app/app/visa/_components/VisaPage";
import { selectPrimaryTrip } from "@/app/app/_lib/use-primary-trip";
import { pickFirstString, type TripRecord } from "@/app/app/_lib/trip-formatters";
import { getOrCreateVisaGuideForDestination } from "@/app/app/visa/_lib/visa-insights";
import { fallbackVisaGuide } from "@/app/app/visa/_lib/visa-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import { SetAppHeader } from "@/components/AppHeader";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSelectedTripId(
  query: Record<string, string | string[] | undefined>,
  validIds: string[],
): string | null {
  const raw = query.trip;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  if (!id || !validIds.includes(id)) return null;
  return id;
}

export default async function VisaRoutePage({ searchParams }: PageProps) {
  const query = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const { trips: tripsRaw } = await fetchTripsViaMembership(supabase, user.id);
  const trips = tripsRaw as TripRecord[];
  const tripOptions = trips
    .map((trip, index) => {
      const id =
        typeof trip.id === "string" || typeof trip.id === "number" ? String(trip.id) : null;
      if (!id) return null;
      return {
        id,
        title: pickFirstString(trip, ["title", "name", "trip_name"], `Trip ${index + 1}`),
        destination: pickFirstString(trip, ["destination", "location", "city"], ""),
        startDate: pickFirstString(trip, ["start_date", "startDate", "date_from"], ""),
        endDate: pickFirstString(trip, ["end_date", "endDate", "date_to"], ""),
      };
    })
    .filter((trip): trip is { id: string; title: string; destination: string; startDate: string; endDate: string } => trip != null);

  if (tripOptions.length === 0) {
    return (
      <>
        <SetAppHeader title="Visa" showBack />
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 pb-24 pt-8">
          <p className="text-sm text-slate-600">Create a trip first to view visa guidance.</p>
        </main>
      </>
    );
  }

  const { tripId: primaryTripId } = selectPrimaryTrip(trips);
  const selectedTripId = getSelectedTripId(query, tripOptions.map((trip) => trip.id)) ?? primaryTripId ?? tripOptions[0].id;
  const selectedTrip = tripOptions.find((trip) => trip.id === selectedTripId) ?? tripOptions[0];
  const visaGuide = selectedTrip.destination
    ? await getOrCreateVisaGuideForDestination(selectedTrip.destination)
    : fallbackVisaGuide;

  return (
    <>
      <SetAppHeader title="Visa" showBack />
      <VisaPage trips={tripOptions} selectedTripId={selectedTripId} visaGuide={visaGuide} />
    </>
  );
}
