import BackLink from "@/app/app/_components/back-link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import Link from "next/link";
import { redirect } from "next/navigation";

type TripRow = {
  id: string;
  title: string | null;
  location: string | null;
};

export default async function ExpensesHubPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const { trips: tripsRaw, error } = await fetchTripsViaMembership(supabase, user.id, {
    tripColumns: "id, title, location",
  });
  const trips = (tripsRaw ?? []) as TripRow[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-28">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <BackLink href="/app/home">Home</BackLink>
          <BackLink href="/app/trips">Trips</BackLink>
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose a trip to view or add expenses.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error.message}
          </p>
        ) : trips.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            No trips yet.{" "}
            <Link href="/app/create-trip" className="font-medium text-slate-900 underline">
              Create a trip
            </Link>{" "}
            first.
          </div>
        ) : (
          <ul className="space-y-2">
            {trips.map((trip) => {
              const label =
                (trip.title && trip.title.trim()) ||
                (trip.location && trip.location.trim()) ||
                "Trip";
              return (
                <li key={trip.id}>
                  <Link
                    href={`/app/trip/${trip.id}/expenses`}
                    className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{label}</span>
                    {trip.location ? (
                      <p className="mt-1 text-sm text-slate-600">{trip.location}</p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
