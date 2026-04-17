import { pickFirstString, type TripRecord } from "@/app/app/_lib/trip-formatters";

type PrimaryTripResult = {
  trip: TripRecord | null;
  tripId: string | null;
};

function extractYmd(raw: string): string | null {
  const v = raw.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  return m?.[1] ?? null;
}

function parseTripDate(raw: string): Date | null {
  const ymd = extractYmd(raw);
  if (!ymd) return null;
  const d = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTripId(trip: TripRecord): string | null {
  if (typeof trip.id === "string" || typeof trip.id === "number") {
    return String(trip.id);
  }
  return null;
}

export function selectPrimaryTrip(trips: TripRecord[], now: Date = new Date()): PrimaryTripResult {
  const validTrips = trips
    .map((trip) => ({ trip, id: getTripId(trip) }))
    .filter((entry): entry is { trip: TripRecord; id: string } => entry.id != null);

  if (validTrips.length === 0) {
    return { trip: null, tripId: null };
  }

  const ongoing = validTrips.find(({ trip }) => {
    const start = parseTripDate(pickFirstString(trip, ["start_date", "startDate", "date_from"], ""));
    const end = parseTripDate(pickFirstString(trip, ["end_date", "endDate", "date_to"], ""));
    if (!start || !end) return false;
    return now >= start && now <= end;
  });
  if (ongoing) {
    return { trip: ongoing.trip, tripId: ongoing.id };
  }

  const upcoming = validTrips
    .map(({ trip, id }) => ({
      trip,
      id,
      start: parseTripDate(pickFirstString(trip, ["start_date", "startDate", "date_from"], "")),
    }))
    .filter((entry): entry is { trip: TripRecord; id: string; start: Date } => entry.start != null)
    .filter((entry) => entry.start >= now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  if (upcoming) {
    return { trip: upcoming.trip, tripId: upcoming.id };
  }

  return { trip: validTrips[0].trip, tripId: validTrips[0].id };
}
