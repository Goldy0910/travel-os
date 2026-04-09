import HubTripCard from "@/app/app/_components/hub-trip-card";
import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import Link from "next/link";
import { redirect } from "next/navigation";
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

function destinationCover(location: string): string {
  const key = normalizePlace(location);
  if (key.includes("manali")) {
    return "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80";
  }
  if (key.includes("tokyo")) {
    return "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=900&q=80";
  }
  if (key.includes("goa")) {
    return "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=80";
  }
  return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=900&q=80";
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
          .select("id, trip_id, amount, total_amount, paid_by_user_id, created_by")
          .in("trip_id", tripIds)
      : { data: [] as TripRecord[] };

  const expenseSummary = new Map<string, { total: number; count: number; net: number }>();
  const expenseIds: string[] = [];
  for (const row of expensesData ?? []) {
    const tid = row.trip_id;
    if (tid == null) continue;
    const id = String(tid);
    const amt = pickFirstNumber(row, ["amount", "total_amount"]);
    const cur = expenseSummary.get(id) ?? { total: 0, count: 0, net: 0 };
    cur.total += amt;
    cur.count += 1;
    expenseSummary.set(id, cur);
    if (row.id != null) expenseIds.push(String(row.id));
  }

  const { data: participantRows } =
    expenseIds.length > 0
      ? await supabase
          .from("expense_participants")
          .select("expense_id, user_id, computed_amount")
          .in("expense_id", expenseIds)
      : { data: [] as TripRecord[] };
  const participantByExpense = new Map<string, Array<{ userId: string; amount: number }>>();
  for (const row of participantRows ?? []) {
    const eid = row.expense_id != null ? String(row.expense_id) : "";
    const uid = row.user_id != null ? String(row.user_id) : "";
    const amount = pickFirstNumber(row, ["computed_amount"]);
    if (!eid || !uid) continue;
    const cur = participantByExpense.get(eid) ?? [];
    cur.push({ userId: uid, amount });
    participantByExpense.set(eid, cur);
  }

  for (const row of expensesData ?? []) {
    const tripId = row.trip_id != null ? String(row.trip_id) : "";
    const expenseId = row.id != null ? String(row.id) : "";
    if (!tripId || !expenseId) continue;
    const summary = expenseSummary.get(tripId);
    if (!summary) continue;

    const payer =
      (row.paid_by_user_id != null ? String(row.paid_by_user_id) : "") ||
      (row.created_by != null ? String(row.created_by) : "");
    const participants = participantByExpense.get(expenseId);
    if (payer && participants && participants.length > 0) {
      for (const p of participants) {
        if (p.userId === payer) continue;
        if (payer === user.id) summary.net += p.amount;
        if (p.userId === user.id) summary.net -= p.amount;
      }
    }
  }

  const { data: membersRows } =
    tripIds.length > 0
      ? await supabase.from("members").select("trip_id").in("trip_id", tripIds)
      : { data: [] as TripRecord[] };
  const memberCountByTrip = new Map<string, number>();
  for (const row of membersRows ?? []) {
    const tripId = row.trip_id != null ? String(row.trip_id) : "";
    if (!tripId) continue;
    memberCountByTrip.set(tripId, (memberCountByTrip.get(tripId) ?? 0) + 1);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-[calc(var(--travel-os-bottom-nav-h)+6rem)]">
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
              <p>No trips yet. Create your first itinerary.</p>
              <div className="mt-3 flex gap-3">
                <Link
                  href="/app/create-trip"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white"
                >
                  Create trip
                  <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-white" />
                </Link>
                <Link
                  href="/app/home"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700"
                >
                  Go home
                  <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-600" />
                </Link>
              </div>
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
              return tripId ? (
                <HubTripCard
                  key={tripId}
                  href={`/app/trip/${tripId}?tab=itinerary`}
                  title={title}
                  dateRange={dateLabel}
                  memberCount={memberCountByTrip.get(tripId) ?? 0}
                  netBalance={summary?.net ?? 0}
                  imageUrl={destinationCover(location)}
                />
              ) : (
                <article key={`${title}-${location}-${index}`} />
              );
            })
          )}
        </section>
      </div>

    </main>
  );
}
