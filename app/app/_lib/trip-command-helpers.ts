import type { TripRecord } from "@/app/app/_lib/trip-formatters";
import { pickFirstString } from "@/app/app/_lib/trip-formatters";

export function dashboardTimezone() {
  return process.env.DASHBOARD_TIMEZONE ?? "Asia/Kolkata";
}

/** Calendar YYYY-MM-DD in configured timezone */
export function getYmdInTz(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${day}`;
}

export function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return { y, m: mo, d };
}

/** Next calendar day YYYY-MM-DD (local date math, not TZ-perfect for DST edges) */
export function addDaysYmd(ymd: string, delta: number): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const dt = new Date(p.y, p.m - 1, p.d + delta);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function compareYmd(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function extractTripYmd(raw: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw).trim());
  return m?.[1] ?? null;
}

export function pickActiveTripId(
  trips: TripRecord[],
  tripIds: string[],
  preferredId: string | null,
): string | null {
  if (preferredId && tripIds.includes(preferredId)) return preferredId;

  const tz = dashboardTimezone();
  const today = getYmdInTz(new Date(), tz);

  const rows = trips
    .map((trip) => {
      const id =
        typeof trip.id === "string" || typeof trip.id === "number" ? String(trip.id) : null;
      if (!id || !tripIds.includes(id)) return null;
      const startRaw = pickFirstString(trip, ["start_date", "startDate", "date_from"], "");
      const endRaw = pickFirstString(trip, ["end_date", "endDate", "date_to"], "");
      const start = extractTripYmd(startRaw);
      const end = extractTripYmd(endRaw);
      return { id, start, end };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (rows.length === 0) return null;

  const inProgress = rows.filter(
    (r) => r.start && r.end && compareYmd(today, r.start) >= 0 && compareYmd(today, r.end) <= 0,
  );
  if (inProgress.length > 0) {
    inProgress.sort((a, b) => compareYmd(a.end!, b.end!));
    return inProgress[0]!.id;
  }

  const upcoming = rows.filter((r) => r.start && compareYmd(today, r.start) < 0);
  if (upcoming.length > 0) {
    upcoming.sort((a, b) => compareYmd(a.start!, b.start!));
    return upcoming[0]!.id;
  }

  const past = rows.filter((r) => r.end && compareYmd(today, r.end) > 0);
  if (past.length > 0) {
    past.sort((a, b) => compareYmd(b.end!, a.end!));
    return past[0]!.id;
  }

  return rows[0]!.id;
}

export function tripDayContext(
  trip: TripRecord,
  todayYmd: string,
): { label: string; currentDay: number; totalDays: number } | null {
  const startRaw = pickFirstString(trip, ["start_date", "startDate", "date_from"], "");
  const endRaw = pickFirstString(trip, ["end_date", "endDate", "date_to"], "");
  const start = extractTripYmd(startRaw);
  const end = extractTripYmd(endRaw);

  if (!start || !end) return null;

  const pStart = parseYmd(start);
  const pEnd = parseYmd(end);
  const pToday = parseYmd(todayYmd);
  if (!pStart || !pEnd || !pToday) return null;

  const startTime = new Date(pStart.y, pStart.m - 1, pStart.d).getTime();
  const endTime = new Date(pEnd.y, pEnd.m - 1, pEnd.d).getTime();
  const todayTime = new Date(pToday.y, pToday.m - 1, pToday.d).getTime();

  const totalDays = Math.round((endTime - startTime) / 86400000) + 1;
  if (totalDays < 1) return null;

  if (todayTime < startTime) {
    const daysUntil = Math.ceil((startTime - todayTime) / 86400000);
    return { label: `Starts in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`, currentDay: 0, totalDays };
  }
  if (todayTime > endTime) {
    return { label: "Trip ended", currentDay: totalDays, totalDays };
  }

  const currentDay = Math.round((todayTime - startTime) / 86400000) + 1;
  return {
    label: `Day ${currentDay} of ${totalDays}`,
    currentDay: Math.min(currentDay, totalDays),
    totalDays,
  };
}
