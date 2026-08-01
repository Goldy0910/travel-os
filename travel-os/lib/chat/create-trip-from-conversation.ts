import { DESTINATION_CATALOG } from "@/lib/find-destination/catalog";
import type { ConversationMemory } from "@/lib/chat/memory-types";

export type ResolvedChatTripDraft = {
  location: string;
  travelPlaceSlug: string | null;
  startDate: string;
  endDate: string;
  budget: string | null;
  travelers: string | null;
  destinationLabel: string;
  warnings: string[];
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function parseDurationDays(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = raw.toLowerCase();
  const week = /(\d+)\s*weeks?/.exec(text);
  if (week) return Math.max(2, Number(week[1]) * 7);
  const day = /(\d+)\s*days?/.exec(text);
  if (day) return Math.max(1, Number(day[1]));
  if (/weekend/.test(text)) return 3;
  if (/one week|1 week|a week/.test(text)) return 7;
  if (/two weeks|2 weeks/.test(text)) return 14;
  return null;
}

/** Best-effort parse of free-text travel dates into YYYY-MM-DD pair. */
export function parseTravelDates(
  travelDates: string | null | undefined,
  travelDuration: string | null | undefined,
): { startDate: string; endDate: string } | null {
  const raw = (travelDates ?? "").trim();
  if (!raw) return null;

  const isoRange = /(\d{4}-\d{2}-\d{2}).{0,30}(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (isoRange) {
    const startDate = isoRange[1]!;
    const endDate = isoRange[2]!;
    if (endDate >= startDate) return { startDate, endDate };
  }

  const singleIso = /(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (singleIso && !/to|–|—|-/.test(raw.replace(singleIso[0], ""))) {
    const startDate = singleIso[1]!;
    const days = parseDurationDays(travelDuration) ?? 5;
    return { startDate, endDate: ymd(addDays(new Date(`${startDate}T12:00:00`), days - 1)) };
  }

  // e.g. "March 10-17 2026" / "10 Mar to 20 Mar 2026"
  const monthNames =
    "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
  const human = new RegExp(
    `(\\d{1,2})\\s*(${monthNames})(?:\\s*(\\d{4}))?\\s*(?:to|through|–|—|-)\\s*(\\d{1,2})\\s*(${monthNames})?\\s*(\\d{4})?`,
    "i",
  ).exec(raw);
  if (human) {
    const year = Number(human[6] || human[3] || new Date().getFullYear());
    const start = Date.parse(`${human[1]} ${human[2]} ${year}`);
    const endMonth = human[5] || human[2];
    const end = Date.parse(`${human[4]} ${endMonth} ${year}`);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      return { startDate: ymd(new Date(start)), endDate: ymd(new Date(end)) };
    }
  }

  // Duration alone is not enough for "ready" — only used when caller passes duration as dates text.
  const durationDays = parseDurationDays(raw);
  if (durationDays && !travelDates) {
    const start = addDays(new Date(), 14);
    return { startDate: ymd(start), endDate: ymd(addDays(start, durationDays - 1)) };
  }

  return null;
}

/** True when destination + explicit travel dates are present (no auto-create). */
export function isConversationReadyToCreateTrip(memory: ConversationMemory): boolean {
  if (!resolveDestinationFromMemory(memory)) return false;
  if (!memory.travel_dates?.trim()) return false;
  const dates = parseTravelDates(memory.travel_dates, memory.travel_duration);
  return Boolean(dates?.startDate && dates?.endDate && dates.endDate >= dates.startDate);
}

export function resolveDestinationFromMemory(memory: ConversationMemory): {
  location: string;
  travelPlaceSlug: string | null;
  destinationLabel: string;
} | null {
  const label =
    memory.preferred_destination?.trim() ||
    memory.candidate_destinations[0]?.trim() ||
    "";
  if (!label) return null;

  const n = normalize(label);
  const catalogHit = DESTINATION_CATALOG.find((d) => {
    const name = normalize(d.name);
    const slug = normalize(d.slug.replace(/-/g, " "));
    const withCountry = normalize(`${d.name} ${d.country}`);
    return n === name || n === withCountry || n.includes(name) || name.includes(n) || slug.includes(n);
  });

  if (catalogHit) {
    return {
      location: `${catalogHit.name}, ${catalogHit.country}`,
      travelPlaceSlug: catalogHit.travelPlaceSlug ?? catalogHit.slug,
      destinationLabel: catalogHit.name,
    };
  }

  return {
    location: label,
    travelPlaceSlug: null,
    destinationLabel: label,
  };
}

export function buildTripDraftFromMemory(
  memory: ConversationMemory,
  overrides?: {
    location?: string;
    startDate?: string;
    endDate?: string;
    budget?: string | null;
    travelers?: string | null;
  },
): { ok: true; draft: ResolvedChatTripDraft } | { ok: false; error: string; draft?: Partial<ResolvedChatTripDraft> } {
  const warnings: string[] = [];
  const resolved = resolveDestinationFromMemory(memory);
  const location = overrides?.location?.trim() || resolved?.location || "";
  if (!location) {
    return {
      ok: false,
      error: "Pick a destination in the chat first (or set preferred destination in memory).",
    };
  }

  const parsed = memory.travel_dates?.trim()
    ? parseTravelDates(memory.travel_dates, memory.travel_duration)
    : null;
  let startDate = overrides?.startDate?.trim() || parsed?.startDate || "";
  let endDate = overrides?.endDate?.trim() || parsed?.endDate || "";

  if (!startDate || !endDate) {
    return {
      ok: false,
      error: "Travel dates are still missing. Share dates in chat, then try again.",
      draft: {
        location,
        travelPlaceSlug: resolved?.travelPlaceSlug ?? null,
        budget: memory.budget,
        travelers: memory.group_size,
        destinationLabel: resolved?.destinationLabel || location,
      },
    };
  }

  if (endDate < startDate) {
    return { ok: false, error: "End date must be on or after start date." };
  }

  const budget =
    overrides?.budget !== undefined ? overrides.budget : memory.budget;
  const travelers =
    overrides?.travelers !== undefined ? overrides.travelers : memory.group_size;

  return {
    ok: true,
    draft: {
      location,
      travelPlaceSlug: resolved?.travelPlaceSlug ?? null,
      startDate,
      endDate,
      budget: budget?.trim() || null,
      travelers: travelers?.trim() || null,
      destinationLabel: resolved?.destinationLabel || location,
      warnings,
    },
  };
}
