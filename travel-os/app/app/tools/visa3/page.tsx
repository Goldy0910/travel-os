import Visa3Client from "@/app/app/tools/visa3/_components/Visa3Client";
import { inferCountryFromDestination, flagFromCountryName } from "@/app/app/tools/_lib/geo";
import type { TripVisa3Option } from "@/app/app/tools/visa3/_lib/types";
import { selectPrimaryTrip } from "@/app/app/_lib/use-primary-trip";
import { pickFirstString, type TripRecord } from "@/app/app/_lib/trip-formatters";
import { SetAppHeader } from "@/components/AppHeader";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import { redirect } from "next/navigation";

function extractYmd(raw: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return match?.[1] ?? "";
}

function pickPassportDefault(
  profile: { nationality?: string | null; passport_country?: string | null } | null,
  metadata: Record<string, unknown> | undefined,
): string {
  const fromProfile =
    (typeof profile?.passport_country === "string" && profile.passport_country.trim()) ||
    (typeof profile?.nationality === "string" && profile.nationality.trim()) ||
    "";
  if (fromProfile) return fromProfile;
  for (const key of ["passport_country", "passportCountry", "nationality", "citizenship"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "India";
}

function selectUpcomingTripId(trips: TripVisa3Option[]): string | null {
  const now = new Date();
  const upcoming = trips
    .filter((trip) => new Date(`${trip.startDate}T12:00:00`) >= now)
    .sort(
      (a, b) =>
        new Date(`${a.startDate}T12:00:00`).getTime() - new Date(`${b.startDate}T12:00:00`).getTime(),
    )[0];
  return upcoming?.id ?? null;
}

export default async function Visa3Page() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const { trips: tripsRaw } = await fetchTripsViaMembership(supabase, user.id);
  const trips = (tripsRaw ?? []) as TripRecord[];
  const tripOptions = trips
    .map((trip, index): TripVisa3Option | null => {
      const id = typeof trip.id === "string" || typeof trip.id === "number" ? String(trip.id) : null;
      if (!id) return null;
      const title = pickFirstString(trip, ["title", "name", "trip_name"], `Trip ${index + 1}`);
      const destination = pickFirstString(trip, ["destination", "location", "city", "place"], "");
      const destinationCountry = inferCountryFromDestination(destination);
      return {
        id,
        title,
        destination,
        destinationCountry,
        flagEmoji: flagFromCountryName(destinationCountry),
        startDate: extractYmd(pickFirstString(trip, ["start_date", "startDate", "date_from"], "")),
        endDate: extractYmd(pickFirstString(trip, ["end_date", "endDate", "date_to"], "")),
      };
    })
    .filter((trip): trip is TripVisa3Option => trip != null);

  const profileRes = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const profile = profileRes.error
    ? null
    : (profileRes.data as { nationality?: string | null; passport_country?: string | null } | null);

  const upcomingTripId = selectUpcomingTripId(tripOptions);
  const { tripId: primaryTripId } = selectPrimaryTrip(trips);
  const defaultTripId = upcomingTripId ?? primaryTripId ?? tripOptions[0]?.id ?? "";

  if (!tripOptions.length || !defaultTripId) {
    return (
      <>
        <SetAppHeader title="Visa" showBack />
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 pb-24 pt-8">
          <p className="text-sm text-slate-600">Create a trip first to use Visa.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <SetAppHeader title="Visa" showBack />
      <Visa3Client
        trips={tripOptions}
        defaultTripId={defaultTripId}
        defaultPassportCountry={pickPassportDefault(profile, user.user_metadata)}
      />
    </>
  );
}
