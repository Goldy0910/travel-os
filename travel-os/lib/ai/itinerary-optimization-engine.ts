import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateDelayMinutes } from "@/lib/ai/optimization-helpers";

export type OptimizationScenario =
  | "running_late"
  | "missed_activities"
  | "weather_issue"
  | "low_energy"
  | "change_mood"
  | "skip_place";

export type ItineraryOptimizationActivity = {
  id: string;
  trip_id: string;
  itinerary_day_id: string | number | null;
  date: string;
  title: string;
  location: string;
  time: string | null;
  priority_score: number | null;
  sunset_sensitive: boolean;
  booking_required: boolean;
  ai_generated: boolean;
  user_modified: boolean;
};

export type OptimizationContext = {
  scenario: OptimizationScenario;
  nowIso: string;
  fatigueLevel?: "low" | "medium" | "high";
  userPreferenceWeight?: number;
  mood?:
    | "calm"
    | "adventure"
    | "culture"
    | "food"
    | "mixed"
    | "relax"
    | "explore"
    | "foodie"
    | "nightlife"
    | "romantic";
  weatherSummary?: string;
  skipActivityId?: string;
  delayMinutes?: number;
  transportMode?: "walking" | "public_transport" | "ride_hailing" | "mixed" | "unknown";
};

export type OptimizationResult = {
  updatedActivities: ItineraryOptimizationActivity[];
  removedActivityIds: string[];
  delayedActivityIds: string[];
  reasoning: string;
};

function buildScenarioReasoning(input: {
  scenario: OptimizationScenario;
  removedCount: number;
  delayedCount: number;
  conflictCount: number;
  keptCount: number;
}): string {
  const parts: string[] = [];

  if (input.scenario === "running_late") {
    parts.push(
      input.delayedCount > 0
        ? `Shifted ${input.delayedCount} activity timings to recover from delay.`
        : "Adjusted timing windows to reduce late arrivals.",
    );
  } else if (input.scenario === "skip_place") {
    parts.push(
      input.removedCount > 0
        ? `Removed ${input.removedCount} lower-priority stop and rebalanced the day.`
        : "Rebalanced the day after your skip request.",
    );
  } else if (input.scenario === "weather_issue") {
    parts.push("Prioritized weather-safe flow and reduced risky outdoor dependencies.");
  } else if (input.scenario === "low_energy") {
    parts.push("Reduced effort-heavy segments and kept a lighter pace.");
  } else if (input.scenario === "change_mood") {
    parts.push("Reshaped the day to match your selected mood while preserving key experiences.");
  } else if (input.scenario === "missed_activities") {
    parts.push("Re-ordered remaining activities after missed items.");
  }

  if (input.conflictCount > 0) {
    parts.push(`Resolved ${input.conflictCount} schedule conflict${input.conflictCount === 1 ? "" : "s"}.`);
  }
  parts.push(`Keeping ${input.keptCount} high-value stop${input.keptCount === 1 ? "" : "s"} practical.`);
  return parts.join(" ");
}

function parseMinutesFromTime(time: string | null): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function activityScore(
  activity: ItineraryOptimizationActivity,
  context: OptimizationContext,
): number {
  let score = activity.priority_score ?? 50;
  if (activity.sunset_sensitive) score += 15;
  if (activity.booking_required) score += 25;
  if (activity.user_modified) score += 12;
  if (activity.ai_generated) score -= 4;
  if (context.weatherSummary?.toLowerCase().includes("rain")) {
    if (/park|walk|beach|viewpoint|trail/i.test(activity.title)) score -= 20;
  }
  if (context.fatigueLevel === "high") {
    if (/museum|hike|trek|long|tour/i.test(activity.title)) score -= 12;
  }
  if (context.mood === "calm" && /club|party|nightlife/i.test(activity.title)) score -= 10;
  if (context.mood === "adventure" && /spa|shopping/i.test(activity.title)) score -= 8;
  if (context.mood === "relax" && /trek|hike|adventure|rush/i.test(activity.title)) score -= 12;
  if (context.mood === "explore" && /spa|rest|hotel/i.test(activity.title)) score -= 8;
  if (context.mood === "foodie" && /food|restaurant|cafe|market|dining/i.test(activity.title)) score += 10;
  if (context.mood === "nightlife" && /bar|club|live|night/i.test(activity.title)) score += 10;
  if (context.mood === "romantic" && /sunset|view|cruise|dinner|garden/i.test(activity.title)) score += 10;
  return Math.max(0, Math.min(100, score));
}

export function calculateRemainingTime(
  nowIso: string,
  endHourLocal = 22,
): number {
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) return 0;
  const end = new Date(now);
  end.setHours(endHourLocal, 0, 0, 0);
  return Math.max(0, Math.round((end.getTime() - now.getTime()) / 60000));
}

export function estimateRealisticTravelTiming(input: {
  distanceKm: number;
  transportMode: OptimizationContext["transportMode"];
  fatigueLevel?: OptimizationContext["fatigueLevel"];
}): number {
  const base = estimateDelayMinutes({
    distanceKm: input.distanceKm,
    mode: input.transportMode ?? "unknown",
    trafficLevel: "medium",
  });
  if (input.fatigueLevel === "high") return Math.round(base * 1.2);
  if (input.fatigueLevel === "low") return Math.round(base * 0.9);
  return base;
}

export function detectScheduleConflicts(
  activities: ItineraryOptimizationActivity[],
): Array<{ firstId: string; secondId: string }> {
  const ordered = [...activities]
    .filter((a) => parseMinutesFromTime(a.time) != null)
    .sort((a, b) => (parseMinutesFromTime(a.time) ?? 0) - (parseMinutesFromTime(b.time) ?? 0));

  const conflicts: Array<{ firstId: string; secondId: string }> = [];
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const cur = ordered[i]!;
    const next = ordered[i + 1]!;
    const curTime = parseMinutesFromTime(cur.time) ?? 0;
    const nextTime = parseMinutesFromTime(next.time) ?? 0;
    const travelBuffer = estimateRealisticTravelTiming({
      distanceKm: 6,
      transportMode: "mixed",
    });
    if (nextTime - curTime < 60 + travelBuffer) {
      conflicts.push({ firstId: cur.id, secondId: next.id });
    }
  }
  return conflicts;
}

export function preserveSunsetActivities(
  activities: ItineraryOptimizationActivity[],
): ItineraryOptimizationActivity[] {
  return [...activities].sort((a, b) => Number(b.sunset_sensitive) - Number(a.sunset_sensitive));
}

export function prioritizeReservations(
  activities: ItineraryOptimizationActivity[],
): ItineraryOptimizationActivity[] {
  return [...activities].sort((a, b) => Number(b.booking_required) - Number(a.booking_required));
}

export function optimizeRouteOrder(
  activities: ItineraryOptimizationActivity[],
  context: OptimizationContext,
): ItineraryOptimizationActivity[] {
  const sorted = [...activities].sort((a, b) => activityScore(b, context) - activityScore(a, context));
  const startMinutes = parseMinutesFromTime(sorted[0]?.time ?? null) ?? 9 * 60;
  return sorted.map((activity, index) => ({
    ...activity,
    time: formatMinutes(startMinutes + index * 120),
  }));
}

export function optimizeDayPlan(
  activities: ItineraryOptimizationActivity[],
  context: OptimizationContext,
): OptimizationResult {
  let next = [...activities];
  const removedActivityIds: string[] = [];
  const delayedActivityIds: string[] = [];
  let conflictCount = 0;

  if (context.skipActivityId) {
    next = next.filter((a) => a.id !== context.skipActivityId);
    removedActivityIds.push(context.skipActivityId);
  }

  if (context.scenario === "running_late" && (context.delayMinutes ?? 0) > 0) {
    next = next.map((activity) => {
      const t = parseMinutesFromTime(activity.time);
      if (t == null) return activity;
      delayedActivityIds.push(activity.id);
      return { ...activity, time: formatMinutes(t + (context.delayMinutes ?? 0)) };
    });
  }

  next = prioritizeReservations(preserveSunsetActivities(next));
  next = optimizeRouteOrder(next, context);

  const remaining = calculateRemainingTime(context.nowIso);
  const capacity = Math.max(1, Math.floor(remaining / 120));
  if (next.length > capacity) {
    const sortedByValue = [...next].sort((a, b) => activityScore(a, context) - activityScore(b, context));
    const dropCount = next.length - capacity;
    const toDrop = new Set(sortedByValue.slice(0, dropCount).map((a) => a.id));
    removedActivityIds.push(...Array.from(toDrop));
    next = next.filter((a) => !toDrop.has(a.id));
  }

  const conflicts = detectScheduleConflicts(next);
  conflictCount = conflicts.length;
  if (conflicts.length > 0) {
    const conflictIds = new Set(conflicts.map((c) => c.secondId));
    next = next.filter((a) => !conflictIds.has(a.id) || a.booking_required || a.sunset_sensitive);
    removedActivityIds.push(...Array.from(conflictIds).filter((id) => !next.some((a) => a.id === id)));
  }

  const reasoning = buildScenarioReasoning({
    scenario: context.scenario,
    removedCount: Array.from(new Set(removedActivityIds)).length,
    delayedCount: Array.from(new Set(delayedActivityIds)).length,
    conflictCount,
    keptCount: next.length,
  });

  return {
    updatedActivities: next,
    removedActivityIds: Array.from(new Set(removedActivityIds)),
    delayedActivityIds: Array.from(new Set(delayedActivityIds)),
    reasoning,
  };
}

function pickFirstString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return "";
}

export async function loadDayActivities(
  supabase: SupabaseClient,
  tripId: string,
  date: string,
): Promise<ItineraryOptimizationActivity[]> {
  const { data } = await supabase
    .from("itinerary_items")
    .select("*")
    .eq("trip_id", tripId)
    .eq("date", date)
    .order("time", { ascending: true, nullsFirst: false });

  return (data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    return {
      id: String(rec.id),
      trip_id: String(rec.trip_id),
      itinerary_day_id:
        rec.itinerary_day_id == null ? null : (typeof rec.itinerary_day_id === "number" ? rec.itinerary_day_id : String(rec.itinerary_day_id)),
      date: pickFirstString(rec, ["date"]),
      title: pickFirstString(rec, ["title", "activity_name"]) || "Activity",
      location: pickFirstString(rec, ["location"]) || "Location TBD",
      time: pickFirstString(rec, ["time"]) || null,
      priority_score:
        typeof rec.priority_score === "number" && Number.isFinite(rec.priority_score)
          ? rec.priority_score
          : null,
      sunset_sensitive: rec.sunset_sensitive === true,
      booking_required: rec.booking_required === true,
      ai_generated: rec.ai_generated === true,
      user_modified: rec.user_modified === true,
    };
  });
}
