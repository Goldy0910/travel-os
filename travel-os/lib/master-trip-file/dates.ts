export function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysToYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return ymdFromDate(d);
}

export function tripDatesFromDayCount(days: number, startOffsetDays = 14): {
  startDate: string;
  endDate: string;
} {
  const start = addDaysToYmd(ymdFromDate(new Date()), startOffsetDays);
  const end = addDaysToYmd(start, Math.max(0, days - 1));
  return { startDate: start, endDate: end };
}

export function enumerateDateYmd(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(ymdFromDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
