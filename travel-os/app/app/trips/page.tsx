import HubTripCard from "@/app/app/_components/hub-trip-card";
import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import { ensureUserMasterFilesLinkedToTrips } from "@/app/app/master-trip/actions";
import { parseMasterTripFile } from "@/lib/master-trip-file";
import { getOrCacheTravelPlacePhotoUrls } from "@/lib/travel-place-photo-cache";
import { isMissingTripMasterFilesTable } from "@/lib/supabase-schema-errors";
import { resolveTripDisplayTitle } from "@/lib/trip-display-title";
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

function tripEndDateIso(trip: TripRecord): string | null {
  for (const key of ["end_date", "endDate", "date_to"]) {
    const value = trip[key];
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
      return value.trim().slice(0, 10);
    }
  }
  return null;
}

function tripStartDateIso(trip: TripRecord): string | null {
  for (const key of ["start_date", "startDate", "date_from"]) {
    const value = trip[key];
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
      return value.trim().slice(0, 10);
    }
  }
  return null;
}

/** Active = no end date yet, or end date is today/future. */
function isActiveTrip(trip: TripRecord, todayIso: string): boolean {
  const end = tripEndDateIso(trip);
  if (!end) return true;
  return end >= todayIso;
}

function sortActiveTrips(trips: TripRecord[]): TripRecord[] {
  return [...trips].sort((a, b) => {
    const as = tripStartDateIso(a) ?? "9999-12-31";
    const bs = tripStartDateIso(b) ?? "9999-12-31";
    return as.localeCompare(bs);
  });
}

function sortPastTrips(trips: TripRecord[]): TripRecord[] {
  return [...trips].sort((a, b) => {
    const ae = tripEndDateIso(a) ?? "";
    const be = tripEndDateIso(b) ?? "";
    return be.localeCompare(ae);
  });
}

export default async function TripsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  await ensureUserMasterFilesLinkedToTrips(supabase, user);

  const { trips: tripsRaw, tripIds, error: membershipTripsError } =
    await fetchTripsViaMembership(supabase, user.id);
  const tripsError = membershipTripsError;
  const trips = (tripsRaw ?? []) as TripRecord[];
  const todayIso = new Date().toISOString().slice(0, 10);
  const activeTrips = sortActiveTrips(trips.filter((trip) => isActiveTrip(trip, todayIso)));
  const pastTrips = sortPastTrips(trips.filter((trip) => !isActiveTrip(trip, todayIso)));

  const destinationNameByTripId = new Map<string, string>();
  if (tripIds.length > 0) {
    const { data: masterRows, error: masterError } = await supabase
      .from("trip_master_files")
      .select("trip_id, data")
      .eq("user_id", user.id)
      .in("trip_id", tripIds);
    if (!isMissingTripMasterFilesTable(masterError)) {
      for (const row of masterRows ?? []) {
        if (!row.trip_id) continue;
        const file = parseMasterTripFile(row.data);
        if (file?.destination.name) {
          destinationNameByTripId.set(String(row.trip_id), file.destination.name);
        }
      }
    }
  }

  const tripLocations = Array.from(
    new Set(
      trips
        .map((trip) =>
          pickFirstString(trip, ["location", "destination", "city", "place"], "").trim(),
        )
        .filter((value) => value.length > 0),
    ),
  );
  const photoByLocation = await getOrCacheTravelPlacePhotoUrls(supabase, tripLocations);

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

  function renderTripCard(trip: TripRecord, index: number) {
    const tripIdForTitle =
      typeof trip.id === "string" || typeof trip.id === "number" ? String(trip.id) : null;
    const location = pickFirstString(trip, ["location", "destination", "city", "place"], "travel");
    const title = resolveTripDisplayTitle({
      storedTitle: pickFirstString(trip, ["title", "name", "trip_name"], ""),
      location,
      destinationName: tripIdForTitle
        ? destinationNameByTripId.get(tripIdForTitle)
        : undefined,
      fallback: `Trip ${index + 1}`,
    });
    const startDate = pickFirstDate(trip, ["start_date", "startDate", "date_from"]);
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
      typeof trip.id === "string" || typeof trip.id === "number" ? String(trip.id) : null;
    if (!tripId) return null;

    const summary = expenseSummary.get(tripId);
    return (
      <HubTripCard
        key={tripId}
        href={`/app/trip/${tripId}?tab=itinerary`}
        title={title}
        dateRange={dateLabel}
        memberCount={memberCountByTrip.get(tripId) ?? 0}
        netBalance={summary?.net ?? 0}
        imageUrl={photoByLocation.get(location) ?? ""}
      />
    );
  }

  return (
    <main className="w-full bg-slate-50 px-4 py-5 pb-[calc(var(--travel-os-bottom-nav-h)+5rem)] sm:py-6 sm:pb-[calc(var(--travel-os-bottom-nav-h)+5.5rem)]">
      <div className="travel-os-content space-y-5 md:px-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Trips</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every trip you created or joined — active ones first.
          </p>
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
                prefetch={false}
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
          <>
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Active trips</h2>
                <span className="text-sm text-slate-500">{activeTrips.length}</span>
              </div>
              {activeTrips.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600">
                  No active trips right now. Create one or check past trips below.
                </div>
              ) : (
                activeTrips.map((trip, index) => renderTripCard(trip, index))
              )}
            </section>

            {pastTrips.length > 0 ? (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">Past trips</h2>
                  <span className="text-sm text-slate-500">{pastTrips.length}</span>
                </div>
                {pastTrips.map((trip, index) => renderTripCard(trip, index))}
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
