import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import Link from "next/link";
import { redirect } from "next/navigation";

type TripRow = {
  id: string;
  title: string | null;
  location: string | null;
};

export default async function DocsHubPage() {
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
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose a trip to view or upload files.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error.message}
          </p>
        ) : trips.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            No trips yet.{" "}
            <Link
              href="/app/create-trip"
              className="inline-flex items-center gap-1 font-medium text-slate-900 underline"
            >
              Create a trip
              <LinkLoadingIndicator spinnerClassName="h-3 w-3 text-slate-800" />
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
                    href={`/app/trip/${trip.id}?tab=docs`}
                    className="relative block rounded-xl border border-slate-200 bg-white p-4 pr-12 shadow-sm active:bg-slate-50"
                  >
                    <span className="pointer-events-none absolute right-3 top-3 inline-flex">
                      <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-600" />
                    </span>
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
