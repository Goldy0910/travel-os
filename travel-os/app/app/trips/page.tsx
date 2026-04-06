import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatInr } from "@/app/app/trip/[id]/expenses/_lib/format-inr";
import {
  formatDate,
  pickFirstDate,
  pickFirstNumber,
  pickFirstString,
  type TripRecord,
} from "../_lib/trip-formatters";

function normalizePlace(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function destinationCover(location: string): string | null {
  const key = normalizePlace(location);
  if (key.includes("manali")) {
    return "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80";
  }
  if (key.includes("tokyo")) {
    return "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=900&q=80";
  }
  return null;
}

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
              const coverImage = destinationCover(location);
              const initials =
                title
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0] ?? "")
                  .join("")
                  .toUpperCase() || "·";

              const cardInner = (
                <div className="flex min-h-[120px] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition active:bg-slate-50/90">
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-4 pr-3">
                    <h3 className="text-base font-semibold leading-snug text-slate-900">{title}</h3>
                    <p className="text-sm text-slate-600">{location}</p>
                    <p className="text-sm text-slate-500">{dateLabel}</p>
                    {summary && summary.count > 0 ? (
                      <p className="pt-0.5 text-sm font-medium text-slate-800">
                        {formatInr(summary.total)}
                        <span className="font-normal text-slate-500">
                          {" "}
                          · {summary.count} expense{summary.count === 1 ? "" : "s"}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  {coverImage ? (
                    <div
                      className="relative w-[36%] max-w-[140px] shrink-0 self-stretch overflow-hidden"
                      aria-hidden
                    >
                      <div
                        className="h-full w-full bg-cover bg-center"
                        style={{ backgroundImage: `url("${coverImage}")` }}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                    </div>
                  ) : (
                    <div
                      className="relative flex w-[36%] max-w-[140px] shrink-0 items-center justify-center self-stretch bg-gradient-to-br from-slate-500 to-slate-700"
                      aria-hidden
                    >
                      <span className="text-lg font-bold text-white/90">{initials}</span>
                    </div>
                  )}
                </div>
              );

              return tripId ? (
                <Link
                  key={tripId}
                  href={`/app/trip/${tripId}?tab=itinerary`}
                  className="relative block"
                >
                  <span className="pointer-events-none absolute right-3 top-3 z-10 inline-flex rounded-full bg-white/90 p-1 shadow-sm">
                    <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-700" />
                  </span>
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
        className="fixed bottom-[var(--travel-os-fab-bottom)] right-[max(1rem,env(safe-area-inset-right,0px))] z-[110] inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-slate-900/25 transition hover:bg-slate-800"
      >
        + Add Trip
        <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-white" />
      </Link>
    </main>
  );
}
