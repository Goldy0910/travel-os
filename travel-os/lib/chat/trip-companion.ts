import type { SupabaseClient } from "@supabase/supabase-js";
import { DESTINATION_CATALOG } from "@/lib/find-destination/catalog";
import { extractYMD } from "@/lib/itinerary-trip-range";
import {
  formatTripMemoryForPrompt,
  loadTripMemory,
  tripMemoryHasValues,
  type TripMemoryFields,
} from "@/lib/trip-memory";
import { getTravelGuidesForPlace } from "@/lib/travelGuides";

/** One scheduled activity on the companion's "today" slice. */
export type CompanionItineraryActivity = {
  id: string;
  title: string;
  time: string | null;
  location: string | null;
  notes: string | null;
  status: string;
};

/** Suggested nearby / alternative options (guide, catalog, or adjacent itinerary). */
export type CompanionNearbyActivity = {
  title: string;
  source: "catalog" | "guide" | "itinerary";
  detail?: string | null;
};

export type CompanionWeather = {
  summary: string;
  source: "guide" | "catalog" | "unknown";
};

/**
 * Structured snapshot injected into trip-scoped AI prompts.
 * Built fresh before each reply when a tripId is present.
 */
export type TripCompanionContext = {
  tripId: string;
  tripTitle: string;
  destination: string;
  /** Calendar date used as "today" (YYYY-MM-DD). */
  currentDate: string;
  /** 1-based day index within the trip date range, or null if outside / unknown. */
  dayIndex: number | null;
  dayCount: number | null;
  tripStartDate: string | null;
  tripEndDate: string | null;
  /** ISO timestamp of when the snapshot was built. */
  nowIso: string;
  /** Local-ish clock string for prompts (server timezone unless overridden). */
  localTime: string;
  weather: CompanionWeather;
  todaysItinerary: CompanionItineraryActivity[];
  nearbyActivities: CompanionNearbyActivity[];
  /** Optional trip_memory complement when available. */
  tripMemory: TripMemoryFields | null;
};

export type LoadTripCompanionOptions = {
  /** Override "today" (YYYY-MM-DD). Defaults to current calendar day. */
  date?: string | null;
  /** Clock used for localTime / nowIso. Defaults to now. */
  now?: Date;
  /** Cap nearby suggestions. */
  nearbyLimit?: number;
};

function ymdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLocalTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function daysBetweenInclusive(start: string, end: string): number | null {
  const a = Date.parse(`${start}T12:00:00`);
  const b = Date.parse(`${end}T12:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.floor((b - a) / 86_400_000) + 1;
}

function dayIndexFor(current: string, start: string | null, end: string | null): number | null {
  if (!start) return null;
  if (end && (current < start || current > end)) return null;
  if (!end && current < start) return null;
  return daysBetweenInclusive(start, current);
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pickTripField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function matchCatalogDestination(destination: string) {
  const n = normalizeTitle(destination);
  if (!n) return null;
  return (
    DESTINATION_CATALOG.find((d) => {
      const name = normalizeTitle(d.name);
      const slug = normalizeTitle(d.slug.replace(/-/g, " "));
      return n === name || n === slug || n.includes(name) || name.includes(n) || slug.includes(n);
    }) ?? null
  );
}

function resolveWeather(destination: string): CompanionWeather {
  const guide = getTravelGuidesForPlace(destination);
  const guideWeather = guide?.essentials.weather?.trim() ?? "";
  if (guideWeather) {
    return { summary: guideWeather, source: "guide" };
  }
  const catalog = matchCatalogDestination(destination);
  const catalogWeather = catalog?.weatherSummary?.trim() ?? "";
  if (catalogWeather) {
    return { summary: catalogWeather, source: "catalog" };
  }
  return { summary: "Weather details unavailable for this destination.", source: "unknown" };
}

function buildNearbyActivities(input: {
  destination: string;
  todaysTitles: Set<string>;
  otherItinerary: Array<{ title: string; date: string | null; location: string | null }>;
  limit: number;
}): CompanionNearbyActivity[] {
  const out: CompanionNearbyActivity[] = [];
  const seen = new Set<string>(input.todaysTitles);

  const push = (item: CompanionNearbyActivity) => {
    const key = normalizeTitle(item.title);
    if (!key || seen.has(key) || out.length >= input.limit) return;
    seen.add(key);
    out.push(item);
  };

  const catalog = matchCatalogDestination(input.destination);
  if (catalog) {
    for (const attraction of catalog.topAttractions ?? []) {
      push({
        title: attraction,
        source: "catalog",
        detail: catalog.name,
      });
    }
  }

  const guide = getTravelGuidesForPlace(input.destination);
  if (guide) {
    for (const video of guide.places.slice(0, 6)) {
      push({
        title: video.title,
        source: "guide",
        detail: "Travel guide highlight",
      });
    }
  }

  for (const row of input.otherItinerary) {
    push({
      title: row.title,
      source: "itinerary",
      detail: row.date
        ? `Also on itinerary${row.location ? ` · ${row.location}` : ""} (${row.date})`
        : row.location,
    });
  }

  return out;
}

/**
 * Load a live companion snapshot for a trip.
 * Soft-fails individual sources (weather/guide/memory) so chat still works.
 */
export async function loadTripCompanionContext(
  supabase: SupabaseClient,
  tripId: string,
  options: LoadTripCompanionOptions = {},
): Promise<TripCompanionContext | null> {
  const id = tripId.trim();
  if (!id) return null;

  const now = options.now ?? new Date();
  const currentDate =
    (typeof options.date === "string" && extractYMD(options.date)) || ymdFromDate(now);
  const nearbyLimit = options.nearbyLimit ?? 8;

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (tripError || !trip) return null;

  const tripRow = trip as Record<string, unknown>;
  const tripTitle = pickTripField(tripRow, ["title", "name"]) || "Trip";
  const destination =
    pickTripField(tripRow, ["location", "destination", "city", "place"]) || "Destination";
  const tripStartDate =
    extractYMD(pickTripField(tripRow, ["start_date", "startDate", "date_from"])) ?? null;
  const tripEndDate =
    extractYMD(pickTripField(tripRow, ["end_date", "endDate", "date_to"])) ?? null;

  const dayCount =
    tripStartDate && tripEndDate ? daysBetweenInclusive(tripStartDate, tripEndDate) : null;
  const dayIndex = dayIndexFor(currentDate, tripStartDate, tripEndDate);

  const richSelect =
    "id, title, activity_name, location, time, date, notes, itinerary_day_id";
  const fallbackSelect = "id, title, activity_name, location, time, date, itinerary_day_id";

  const richItems = await supabase
    .from("itinerary_items")
    .select(richSelect)
    .eq("trip_id", id)
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(80);

  let itemRows: Array<Record<string, unknown>>;
  if (richItems.error) {
    const fallbackItems = await supabase
      .from("itinerary_items")
      .select(fallbackSelect)
      .eq("trip_id", id)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .limit(80);
    itemRows = (fallbackItems.data ?? []) as Array<Record<string, unknown>>;
  } else {
    itemRows = (richItems.data ?? []) as Array<Record<string, unknown>>;
  }

  const dayIds = Array.from(
    new Set(
      itemRows
        .map((r) => (r.itinerary_day_id != null ? String(r.itinerary_day_id) : ""))
        .filter(Boolean),
    ),
  );
  const dayDateById = new Map<string, string>();
  if (dayIds.length > 0) {
    const { data: days } = await supabase
      .from("itinerary_days")
      .select("id, date")
      .eq("trip_id", id)
      .in("id", dayIds);
    for (const day of days ?? []) {
      const row = day as Record<string, unknown>;
      const ymd =
        typeof row.date === "string"
          ? extractYMD(row.date) ?? row.date.trim().slice(0, 10)
          : null;
      if (ymd) dayDateById.set(String(row.id), ymd);
    }
  }

  function itemYmd(row: Record<string, unknown>): string | null {
    if (typeof row.date === "string" && row.date.trim()) {
      return extractYMD(row.date) ?? row.date.trim().slice(0, 10);
    }
    if (row.itinerary_day_id != null) {
      return dayDateById.get(String(row.itinerary_day_id)) ?? null;
    }
    return null;
  }

  const itemIds = itemRows.map((r) => String(r.id ?? "")).filter(Boolean);
  const stateByActivityId: Record<string, string> = {};
  if (itemIds.length > 0) {
    const stateResult = await supabase
      .from("itinerary_activity_state")
      .select("activity_id, status, created_at")
      .in("activity_id", itemIds)
      .order("created_at", { ascending: false });
    if (!stateResult.error) {
      for (const row of (stateResult.data ?? []) as Array<Record<string, unknown>>) {
        const activityId = typeof row.activity_id === "string" ? row.activity_id : "";
        if (!activityId || stateByActivityId[activityId]) continue;
        stateByActivityId[activityId] =
          typeof row.status === "string" ? row.status : "planned";
      }
    }
  }

  const todaysItinerary: CompanionItineraryActivity[] = [];
  const otherItinerary: Array<{ title: string; date: string | null; location: string | null }> =
    [];

  for (const row of itemRows) {
    const title = String(row.title ?? row.activity_name ?? "Activity").trim() || "Activity";
    const ymd = itemYmd(row);
    const location = typeof row.location === "string" ? row.location : null;
    if (ymd === currentDate) {
      todaysItinerary.push({
        id: String(row.id ?? ""),
        title,
        time: typeof row.time === "string" ? row.time : null,
        location,
        notes: typeof row.notes === "string" ? row.notes : null,
        status: stateByActivityId[String(row.id ?? "")] ?? "planned",
      });
    } else {
      otherItinerary.push({ title, date: ymd, location });
    }
  }

  todaysItinerary.sort((a, b) => {
    const ta = a.time ?? "99:99";
    const tb = b.time ?? "99:99";
    return ta.localeCompare(tb);
  });

  const todaysTitles = new Set(todaysItinerary.map((a) => normalizeTitle(a.title)));
  const nearbyActivities = buildNearbyActivities({
    destination,
    todaysTitles,
    otherItinerary,
    limit: nearbyLimit,
  });

  let tripMemory: TripMemoryFields | null = null;
  try {
    const memory = await loadTripMemory(supabase, id);
    tripMemory = tripMemoryHasValues(memory) ? memory : null;
  } catch {
    tripMemory = null;
  }

  return {
    tripId: id,
    tripTitle,
    destination,
    currentDate,
    dayIndex,
    dayCount,
    tripStartDate,
    tripEndDate,
    nowIso: now.toISOString(),
    localTime: formatLocalTime(now),
    weather: resolveWeather(destination),
    todaysItinerary,
    nearbyActivities,
    tripMemory,
  };
}

/** Serialize companion context for system-prompt injection. */
export function formatCompanionContextForPrompt(ctx: TripCompanionContext): string {
  const dayLabel =
    ctx.dayIndex != null && ctx.dayCount != null
      ? `Day ${ctx.dayIndex} of ${ctx.dayCount}`
      : ctx.dayIndex != null
        ? `Day ${ctx.dayIndex}`
        : "Day unknown (outside trip dates or dates missing)";

  const itineraryLines =
    ctx.todaysItinerary.length === 0
      ? ["- (No activities scheduled for this date)"]
      : ctx.todaysItinerary.map((a) => {
          const bits = [
            a.time ? a.time : "untimed",
            a.title,
            a.location ? `@ ${a.location}` : null,
            a.status !== "planned" ? `(${a.status})` : null,
          ].filter(Boolean);
          return `- ${bits.join(" · ")}`;
        });

  const nearbyLines =
    ctx.nearbyActivities.length === 0
      ? ["- (No nearby suggestions)"]
      : ctx.nearbyActivities.map((n) => {
          const detail = n.detail ? ` — ${n.detail}` : "";
          return `- ${n.title} [${n.source}]${detail}`;
        });

  const memoryBlock = ctx.tripMemory
    ? `\n\nTrip Memory (this trip only — do not treat as lasting user prefs):
${formatTripMemoryForPrompt(ctx.tripMemory)}`
    : "";

  return `Trip companion live context:
- Trip: ${ctx.tripTitle} (${ctx.tripId})
- Destination: ${ctx.destination}
- Current date: ${ctx.currentDate} (${dayLabel})
- Trip dates: ${ctx.tripStartDate ?? "?"} → ${ctx.tripEndDate ?? "?"}
- Local time: ${ctx.localTime} (snapshot ${ctx.nowIso})
- Weather (${ctx.weather.source}): ${ctx.weather.summary}

Today's itinerary:
${itineraryLines.join("\n")}

Nearby / alternative activities:
${nearbyLines.join("\n")}${memoryBlock}`;
}
