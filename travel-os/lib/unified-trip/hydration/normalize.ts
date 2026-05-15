import type { NormalizedTripActivity } from "../types";
import type { ParsedActivitySegment, ParsedItinerarySegment } from "./types";

const TIME_HINT_MAP: Record<string, string> = {
  "early morning": "07:30",
  morning: "09:30",
  breakfast: "08:30",
  lunch: "13:00",
  afternoon: "14:30",
  dinner: "19:30",
  evening: "17:30",
  night: "20:30",
};

const DEFAULT_SLOT_TIMES = ["09:30", "13:00", "17:00"];

export function normalizeTimeHint(hint?: string): string | null {
  if (!hint) return null;
  const key = hint.trim().toLowerCase();
  return TIME_HINT_MAP[key] ?? null;
}

export function normalizeClockTime(raw?: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  const m12 = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(t);
  if (m12) {
    let h = Number(m12[1]);
    const min = m12[2];
    const ap = m12[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  return null;
}

export function normalizeCategory(raw?: string): string {
  const c = (raw ?? "sightseeing").trim().toLowerCase();
  const allowed = new Set([
    "sightseeing",
    "culture",
    "food",
    "beach",
    "adventure",
    "shopping",
    "relaxation",
    "logistics",
    "nightlife",
  ]);
  return allowed.has(c) ? c : "sightseeing";
}

export function normalizeActivityTitle(raw: string): string {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return "Activity";
  if (normalized.length <= 56) return normalized;
  return `${normalized.slice(0, 53).trimEnd()}...`;
}

export function parsedSegmentToNormalizedActivity(
  segment: ParsedActivitySegment,
  options: {
    id: string;
    destinationName: string;
    slotIndex: number;
    explicitTime?: string | null;
  },
): NormalizedTripActivity {
  const title = normalizeActivityTitle(segment.title);
  const fromHint = normalizeTimeHint(segment.timeHint);
  const startTime =
    normalizeClockTime(options.explicitTime) ??
    fromHint ??
    DEFAULT_SLOT_TIMES[options.slotIndex % DEFAULT_SLOT_TIMES.length] ??
    "10:00";

  const location =
    segment.locationHint?.trim() ||
    options.destinationName ||
    "Location TBD";

  return {
    id: options.id,
    title,
    description: segment.description.trim() || title,
    location,
    startTime,
    category: normalizeCategory(segment.categoryHint),
    notes: segment.description.trim() !== title ? segment.description.trim() : "",
    placeId: null,
  };
}

export function normalizedActivitiesFromParsedDay(
  parsed: ParsedItinerarySegment,
  destinationName: string,
  dayIdPrefix: string,
): NormalizedTripActivity[] {
  return parsed.segments.map((segment, index) =>
    parsedSegmentToNormalizedActivity(segment, {
      id: `${dayIdPrefix}-a${index}`,
      destinationName,
      slotIndex: index,
    }),
  );
}
