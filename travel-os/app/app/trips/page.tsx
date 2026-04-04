import BackLink from "@/app/app/_components/back-link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  formatCurrency,
  formatDate,
  pickFirstDate,
  pickFirstNumber,
  pickFirstString,
  type TripRecord,
} from "../_lib/trip-formatters";

export default async function TripsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const { trips: tripsRaw, tripIds, error: membershipTripsError } =
    await fetchTripsViaMembership(supabase, user.id);
  const tripsError = membershipTripsError;
  const trips = (tripsRaw ?? []) as TripRecord[];

  const { data: expensesData } =
    tripIds.length > 0
      ? await supabase
          .from("expenses")
          .select("trip_id, amount, total_amount")
          .in("trip_id", tripIds)
      : { data: [] as TripRecord[] };

  const expenseSummary = new Map<string, { total: number; count: number }>();
  for (const row of expensesData ?? []) {
    const tid = row.trip_id;
    if (tid == null) continue;
    const id = String(tid);
    const amt = pickFirstNumber(row, ["amount", "total_amount"]);
    const cur = expenseSummary.get(id) ?? { total: 0, count: 0 };
    cur.total += amt;
    cur.count += 1;
    expenseSummary.set(id, cur);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-28">
      <div className="mx-auto w-full max-w-md space-y-5">
        <BackLink href="/app/home">Home</BackLink>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Trips</h1>
          <p className="mt-1 text-sm text-slate-600">
            Your itineraries and plans in one list.
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">All trips</h2>
            <span className="text-sm text-slate-500">{trips.length}</span>
          </div>

          {tripsError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              Could not load trips: {tripsError.message}
            </div>
          ) : trips.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              No trips yet. Tap Add Trip to create your first itinerary.
            </div>
          ) : (
            trips.map((trip, index) => {
              const title = pickFirstString(
                trip,
                ["title", "name", "trip_name"],
                `Trip ${index + 1}`,
              );
              const location = pickFirstString(
                trip,
                ["location", "destination", "city", "place"],
                "travel",
              );
              const startDate = pickFirstDate(trip, [
                "start_date",
                "startDate",
                "date_from",
              ]);
              const endDate = pickFirstDate(trip, ["end_date", "endDate", "date_to"]);
              const formattedStartDate = formatDate(startDate);
              const formattedEndDate = formatDate(endDate);
              const dateLabel =
                formattedStartDate && formattedEndDate
                  ? `${formattedStartDate} – ${formattedEndDate}`
                  : formattedStartDate
                    ? `${formattedStartDate}`
                    : "Dates not set";

              const tripId =
                typeof trip.id === "string" || typeof trip.id === "number"
                  ? String(trip.id)
                  : null;

              const summary = tripId ? expenseSummary.get(tripId) : undefined;
              const unsplashSrc = `https://source.unsplash.com/featured/?${encodeURIComponent(location)}`;

              const cardInner = (
                <div className="flex min-h-[120px] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition active:bg-slate-50/90">
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-4 pr-3">
                    <h3 className="text-base font-semibold leading-snug text-slate-900">{title}</h3>
                    <p className="text-sm text-slate-600">{location}</p>
                    <p className="text-sm text-slate-500">{dateLabel}</p>
                    {summary && summary.count > 0 ? (
                      <p className="pt-0.5 text-sm font-medium text-slate-800">
                        {formatCurrency(summary.total)}
                        <span className="font-normal text-slate-500">
                          {" "}
                          · {summary.count} expense{summary.count === 1 ? "" : "s"}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <div className="relative w-[36%] max-w-[140px] shrink-0 self-stretch bg-slate-200">
                    {/* Unsplash featured URL is dynamic per trip; next/image is optional here */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={unsplashSrc}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              );

              return tripId ? (
                <Link key={tripId} href={`/app/trip/${tripId}`} className="block">
                  {cardInner}
                </Link>
              ) : (
                <article key={`${title}-${location}-${index}`}>{cardInner}</article>
              );
            })
          )}
        </section>
      </div>

      <Link
        href="/app/create-trip"
        className="fixed bottom-24 right-4 z-[110] min-h-11 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-slate-900/25 transition hover:bg-slate-800"
      >
        + Add Trip
      </Link>
    </main>
  );
}
