import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAiTripContext, runAdaptiveAi } from "@/lib/ai";
import { createItineraryRevision } from "@/lib/ai/itinerary-revision-service";
import type { ItineraryOptimizationActivity } from "@/lib/ai/itinerary-optimization-engine";
import type {
  AiStructuredResponse,
  ItineraryRevision,
} from "@/lib/ai/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { extractYMD } from "@/lib/itinerary-trip-range";

function parseYmd(input: string): string {
  const v = input.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  if (m) return m[1]!;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function parseTimeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  const m12 = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(v);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2] ?? "0");
    const ap = m12[3];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
  }
  const m24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v);
  if (m24) return `${String(Number(m24[1])).padStart(2, "0")}:${m24[2]}`;
  return null;
}

function parseTimeFromMessage(message: string): string | null {
  const text = message.trim().toLowerCase();
  const m12 = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(text);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2] ?? "0");
    const ap = m12[3];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
  }
  const m24 = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  if (m24) {
    return `${String(Number(m24[1])).padStart(2, "0")}:${m24[2]}`;
  }
  return null;
}

function isTimingUpdateRequest(message: string): boolean {
  const text = message.trim().toLowerCase();
  return (
    /\b(update|change|move|shift|reschedule|set)\b/.test(text) &&
    /\btime|timing\b/.test(text)
  );
}

type MutationKind = "add" | "delete" | "update";

function detectMutationIntent(message: string): MutationKind | null {
  const text = message.trim().toLowerCase();
  if (!text) return null;
  if (
    /\b(remove|delete|drop|cancel|skip|cut|take\s+out|get\s+rid\s+of)\b/.test(text)
  ) {
    return "delete";
  }
  if (
    /\b(add|insert|include|create|schedule|book|append|put|plan)\b/.test(text)
  ) {
    return "add";
  }
  if (
    /\b(update|change|modify|edit|reschedule|move|shift|swap|replace|rename|adjust)\b/.test(
      text,
    )
  ) {
    return "update";
  }
  return null;
}

function isAffirmation(message: string): boolean {
  const v = message.trim().toLowerCase().replace(/[!.,]/g, "").trim();
  if (!v) return false;
  if (v.length > 80) return false;
  const patterns: RegExp[] = [
    /^(yes|yeah|yep|yup|sure|ok|okay|alright|please|of course|absolutely|definitely)\b/,
    /\b(do it|do that|go ahead|let'?s do it|sounds good|that works|please add|add (it|them|both|those|these)|yes please|ok do it|sure thing)\b/,
    /^(perfect|great|cool|awesome|nice)\b/,
  ];
  return patterns.some((p) => p.test(v));
}

function detectPendingMutationFromAssistant(
  prevAssistantText: string,
): MutationKind | null {
  const v = prevAssistantText.toLowerCase();
  if (!v) return null;
  if (/(would you like|want|shall|should) (me|i) (to )?(remove|delete|drop|skip)/.test(v)) {
    return "delete";
  }
  if (/(would you like|want|shall|should) (me|i) (to )?(change|move|update|reschedule|swap|shift)/.test(v)) {
    return "update";
  }
  if (
    /(would you like|want|shall|should) (me|i) (to )?(add|include|schedule|put|book|plan|insert)/.test(v) ||
    /add (either|both|these|those|them) to (your|the) itinerary/.test(v) ||
    /shall i add/.test(v)
  ) {
    return "add";
  }
  return null;
}

function pickTargetActivityId(
  message: string,
  items: Array<{ id: string; title: string }>,
): string | null {
  const text = message.toLowerCase();
  const stop = new Set([
    "update",
    "change",
    "move",
    "shift",
    "reschedule",
    "set",
    "time",
    "timing",
    "to",
    "at",
    "for",
    "the",
    "a",
    "an",
    "of",
    "activity",
  ]);
  let best: { id: string; score: number } | null = null;
  for (const item of items) {
    const tokens = item.title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !stop.has(t));
    const score = tokens.reduce((acc, t) => (text.includes(t) ? acc + 1 : acc), 0);
    if (!best || score > best.score) best = { id: item.id, score };
  }
  if (best && best.score > 0) return best.id;
  if (items.length === 1) return items[0]!.id;
  return null;
}

function isNowQuestion(message: string): boolean {
  const v = message.trim().toLowerCase();
  return (
    /what can i do now/.test(v) ||
    /what now/.test(v) ||
    /right now/.test(v) ||
    /for now/.test(v)
  );
}

function buildNowSuggestion(input: {
  now: Date;
  location: string;
  activities: Array<{ title: string; time: string | null; location: string | null }>;
}) {
  const nowMinutes = input.now.getHours() * 60 + input.now.getMinutes();
  const upcoming = input.activities
    .map((activity) => ({
      ...activity,
      minutes: parseTimeToMinutes(activity.time),
    }))
    .filter((activity) => activity.minutes != null && activity.minutes >= nowMinutes)
    .sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0));

  const next = upcoming[0];
  if (next) {
    const etaMinutes = Math.max(10, Math.min(35, Math.round(((next.minutes ?? nowMinutes) - nowMinutes) / 2)));
    const place = next.location?.trim() || input.location;
    return {
      message: `You're about ${etaMinutes} mins away from ${place}. Great timing for ${next.title}.`,
      followUpQuestion: "Want a quieter alternative nearby?",
    };
  }

  return {
    message: `You're in ${input.location}. This is a good window for a nearby high-value stop before evening.`,
    followUpQuestion: "Want a relaxed option or something lively?",
  };
}

function coerceState(v: unknown): "planned" | "completed" | "skipped" | "delayed" | "replaced" {
  const s = typeof v === "string" ? v : "";
  if (s === "completed" || s === "skipped" || s === "delayed" || s === "replaced") return s;
  return "planned";
}

function stringifyCompactContext(input: {
  destination: string;
  date: string;
  nowIso: string;
  tripPace: string;
  energyLevel: string;
  skipped: number;
  completed: number;
  remaining: number;
  activities: Array<{
    id: string;
    title: string;
    time: string | null;
    location: string | null;
    status: string;
    date: string | null;
  }>;
  preferences: string[];
  tripStartDate: string | null;
  tripEndDate: string | null;
}): string {
  const activityLines = input.activities
    .slice(0, 30)
    .map(
      (a) =>
        `- id=${a.id} | day=${a.date ?? input.date ?? "TBD"} | ${a.time ?? "TBD"} · ${a.title} · ${a.location ?? "Unknown"} · ${a.status}`,
    )
    .join("\n");
  return [
    `Trip location: ${input.destination}`,
    `Trip range: ${input.tripStartDate ?? "?"} to ${input.tripEndDate ?? "?"}`,
    `Current day: ${input.date || "unknown"}`,
    `Current time ISO: ${input.nowIso}`,
    `Trip pace: ${input.tripPace}`,
    `Energy level: ${input.energyLevel}`,
    `Counts: remaining=${input.remaining}, completed=${input.completed}, skipped=${input.skipped}`,
    `Preferences: ${input.preferences.join(", ") || "none"}`,
    "Existing activities (use the EXACT id when modifying or deleting):",
    activityLines || "- none loaded",
  ].join("\n");
}

function buildMutationPromptInstructions(input: {
  kind: MutationKind;
  currentDay: string;
  tripStartDate: string | null;
  tripEndDate: string | null;
}): string {
  const kindRule =
    input.kind === "add"
      ? `- To ADD a new activity: leave \`activityId\` EMPTY (do not invent one), set \`state\` to "planned".`
      : input.kind === "delete"
        ? `- To DELETE/REMOVE an activity: include the EXACT existing \`activityId\` from the list, set \`state\` to "skipped".`
        : `- To UPDATE an activity: include the EXACT existing \`activityId\`, set \`state\` to "planned", and change only the fields the user asked about.`;

  const rangeNote =
    input.tripStartDate && input.tripEndDate
      ? `Day MUST be a YYYY-MM-DD between ${input.tripStartDate} and ${input.tripEndDate} inclusive (default to ${input.currentDay || input.tripStartDate}).`
      : `Day MUST be a YYYY-MM-DD (default to ${input.currentDay || "today"}).`;

  return [
    `You MUST respond with valid JSON only, with keys: message, actions, updatedItinerary, reasoning, followUpQuestion.`,
    `The user is requesting a ${input.kind.toUpperCase()} change. Populate \`updatedItinerary\` with one entry PER changed activity. Do NOT include unchanged activities.`,
    `Each updatedItinerary entry MUST be:`,
    `{`,
    `  "day": "YYYY-MM-DD",`,
    `  "activityId": "<existing id or empty string for new>",`,
    `  "title": "<short clear title, e.g. 'Eiffel Tower visit'>",`,
    `  "location": "<specific place name>",`,
    `  "time": "HH:mm" (24-hour, e.g. "09:30" or "14:00"),`,
    `  "state": "planned" | "skipped",`,
    `  "notes": null`,
    `}`,
    kindRule,
    rangeNote,
    `Never invent activityIds. If unsure which activity, omit activityId so it is treated as a new addition.`,
    `Keep the chat \`message\` short (1-3 lines) and consistent with what you put into updatedItinerary.`,
  ].join("\n");
}

type ContextActivityRow = {
  id: string;
  title: string;
  location: string | null;
  time: string | null;
  date: string;
  status: string;
};

async function ensureItineraryDayId(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  date: string,
): Promise<string | number | null> {
  const { data: existingDay } = await supabase
    .from("itinerary_days")
    .select("id")
    .eq("trip_id", tripId)
    .eq("date", date)
    .maybeSingle();
  if (existingDay?.id != null) return existingDay.id;

  const { data: newDay, error } = await supabase
    .from("itinerary_days")
    .insert({ trip_id: tripId, user_id: userId, date })
    .select("id")
    .single();
  if (error || !newDay?.id) return null;
  return newDay.id;
}

type ApplyResult = {
  added: number;
  updated: number;
  deleted: number;
  appliedDays: Set<string>;
  addedTitles: string[];
  updatedTitles: string[];
  deletedTitles: string[];
};

async function applyAssistantRevisions(input: {
  supabase: SupabaseClient;
  tripId: string;
  userId: string;
  fallbackDate: string;
  tripStartDate: string | null;
  tripEndDate: string | null;
  existingActivities: Map<string, ContextActivityRow>;
  revisions: ItineraryRevision[];
}): Promise<ApplyResult> {
  const result: ApplyResult = {
    added: 0,
    updated: 0,
    deleted: 0,
    appliedDays: new Set<string>(),
    addedTitles: [],
    updatedTitles: [],
    deletedTitles: [],
  };

  for (const raw of input.revisions) {
    if (!raw || typeof raw !== "object") continue;

    const day = parseYmd(typeof raw.day === "string" ? raw.day : "") || input.fallbackDate;
    if (!day) continue;
    if (input.tripStartDate && day < input.tripStartDate) continue;
    if (input.tripEndDate && day > input.tripEndDate) continue;

    const activityId = typeof raw.activityId === "string" ? raw.activityId.trim() : "";
    const isExisting = activityId.length > 0 && input.existingActivities.has(activityId);
    const state = coerceState(raw.state);
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const location =
      typeof raw.location === "string" && raw.location.trim() ? raw.location.trim() : null;
    const time = normalizeTime(raw.time);

    if (isExisting && state === "skipped") {
      const { error } = await input.supabase
        .from("itinerary_items")
        .delete()
        .eq("trip_id", input.tripId)
        .eq("id", activityId);
      if (!error) {
        result.deleted += 1;
        result.appliedDays.add(day);
        const existingRow = input.existingActivities.get(activityId);
        const removedTitle = existingRow?.title || title;
        if (removedTitle) result.deletedTitles.push(removedTitle);
      }
      continue;
    }

    if (isExisting) {
      const updates: Record<string, unknown> = {};
      if (title) {
        updates.title = title;
        updates.activity_name = title;
      }
      if (location) updates.location = location;
      if (time) updates.time = time;

      if (Object.keys(updates).length === 0) continue;

      const richUpdate = { ...updates, user_modified: true };
      let { error } = await input.supabase
        .from("itinerary_items")
        .update(richUpdate)
        .eq("trip_id", input.tripId)
        .eq("id", activityId);
      if (error) {
        const fallback = await input.supabase
          .from("itinerary_items")
          .update(updates)
          .eq("trip_id", input.tripId)
          .eq("id", activityId);
        error = fallback.error;
      }
      if (!error) {
        result.updated += 1;
        result.appliedDays.add(day);
        const existingRow = input.existingActivities.get(activityId);
        const updatedTitle = title || existingRow?.title || "";
        if (updatedTitle) result.updatedTitles.push(updatedTitle);
      }
      continue;
    }

    if (state === "skipped") continue;
    if (!title) continue;

    const dayId = await ensureItineraryDayId(input.supabase, input.tripId, input.userId, day);

    const richInsert: Record<string, unknown> = {
      trip_id: input.tripId,
      user_id: input.userId,
      itinerary_day_id: dayId,
      date: day,
      activity_name: title,
      title,
      location: location || "Location TBD",
      time,
      ai_generated: true,
      user_modified: false,
    };
    let { error } = await input.supabase.from("itinerary_items").insert(richInsert);
    if (error) {
      const fallback = await input.supabase.from("itinerary_items").insert({
        trip_id: input.tripId,
        user_id: input.userId,
        itinerary_day_id: dayId,
        date: day,
        activity_name: title,
        title,
        location: location || "Location TBD",
        time,
      });
      error = fallback.error;
    }
    if (!error) {
      result.added += 1;
      result.appliedDays.add(day);
      if (title) result.addedTitles.push(title);
    }
  }

  return result;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ ok: false, error: "Message is required." }, { status: 400 });

  const date = parseYmd(typeof body.date === "string" ? body.date : "");
  const nowIso =
    typeof body.currentTimeIso === "string" && body.currentTimeIso.trim()
      ? body.currentTimeIso
      : new Date().toISOString();
  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  const tripRow = (trip ?? {}) as Record<string, unknown>;
  const destination =
    String(tripRow.destination ?? tripRow.location ?? tripRow.city ?? tripRow.place ?? "").trim() ||
    "Destination";
  const tripTitle = String(tripRow.title ?? tripRow.name ?? "Trip").trim() || "Trip";
  const tripStartDate =
    extractYMD(String(tripRow.start_date ?? tripRow.startDate ?? tripRow.date_from ?? "")) ?? null;
  const tripEndDate =
    extractYMD(String(tripRow.end_date ?? tripRow.endDate ?? tripRow.date_to ?? "")) ?? null;

  const richSelect =
    "id, title, activity_name, location, time, date, itinerary_day_id, priority_score, sunset_sensitive, booking_required, ai_generated, user_modified";
  const fallbackSelect = "id, title, activity_name, location, time, date, itinerary_day_id";
  async function selectItems(select: string) {
    return date
      ? await supabase
          .from("itinerary_items")
          .select(select)
          .eq("trip_id", tripId)
          .eq("date", date)
          .order("time", { ascending: true })
      : await supabase
          .from("itinerary_items")
          .select(select)
          .eq("trip_id", tripId)
          .order("date", { ascending: true })
          .order("time", { ascending: true })
          .limit(40);
  }
  let itemsResult = (await selectItems(richSelect)) as {
    data: Array<Record<string, unknown>> | null;
    error: { message?: string } | null;
  };
  if (itemsResult.error) {
    itemsResult = (await selectItems(fallbackSelect)) as {
      data: Array<Record<string, unknown>> | null;
      error: { message?: string } | null;
    };
  }
  const items = itemsResult.data;

  const itemRows = (items ?? []) as Array<Record<string, unknown>>;
  const itemIds = itemRows.map((row) => String(row.id ?? "")).filter((id) => id.length > 0);
  const stateByActivityId: Record<string, string> = {};
  if (itemIds.length > 0) {
    const activityStateResult = await supabase
      .from("itinerary_activity_state")
      .select("activity_id, status, created_at")
      .in("activity_id", itemIds)
      .order("created_at", { ascending: false });
    if (!activityStateResult.error) {
      const stateRows = (activityStateResult.data ?? []) as Array<Record<string, unknown>>;
      for (const row of stateRows) {
        const activityId = typeof row.activity_id === "string" ? row.activity_id : "";
        if (!activityId || stateByActivityId[activityId]) continue;
        stateByActivityId[activityId] = typeof row.status === "string" ? row.status : "planned";
      }
    }
  }

  const existingActivityList: ContextActivityRow[] = itemRows.map((item) => ({
    id: String(item.id ?? ""),
    title: String(item.title ?? item.activity_name ?? "Activity"),
    location: typeof item.location === "string" ? item.location : null,
    time: typeof item.time === "string" ? item.time : null,
    date:
      typeof item.date === "string" && item.date.trim()
        ? extractYMD(String(item.date)) ?? String(item.date).trim().slice(0, 10)
        : date || "",
    status: stateByActivityId[String(item.id ?? "")] ?? "planned",
  }));
  const existingActivityMap = new Map<string, ContextActivityRow>(
    existingActivityList.filter((row) => row.id).map((row) => [row.id, row]),
  );

  const context = buildAiTripContext({
    tripId,
    tripTitle,
    destination,
    currentDay: date || null,
    tripStartDate,
    tripEndDate,
    activities: existingActivityList.map((item) => ({
      id: item.id,
      title: item.title,
      location: item.location,
      time: item.time,
      state: coerceState(item.status),
    })),
    cityOrLocation: destination,
    weatherPlaceholder: typeof body.weatherSummary === "string" ? body.weatherSummary : "Weather unavailable",
    travelerPreferences: {
      interests: Array.isArray(body.preferences)
        ? body.preferences.map((v) => String(v)).slice(0, 8)
        : [],
      pace:
        body.tripPace === "relaxed" || body.tripPace === "balanced" || body.tripPace === "packed"
          ? body.tripPace
          : "balanced",
    },
    transportMode:
      body.transportMode === "walking" ||
      body.transportMode === "public_transport" ||
      body.transportMode === "ride_hailing" ||
      body.transportMode === "mixed" ||
      body.transportMode === "unknown"
        ? body.transportMode
        : "unknown",
  });

  try {
    const now = new Date(nowIso);
    const contextAwareNow =
      isNowQuestion(message) && date
        ? buildNowSuggestion({
            now,
            location: destination,
            activities: existingActivityList.map((item) => ({
              title: item.title,
              time: item.time,
              location: item.location,
            })),
          })
        : null;

    const compactContext = stringifyCompactContext({
      destination,
      date,
      nowIso,
      tripPace: typeof body.tripPace === "string" ? body.tripPace : "balanced",
      energyLevel: typeof body.energyLevel === "string" ? body.energyLevel : "medium",
      skipped:
        typeof body.skippedActivities === "number" && Number.isFinite(body.skippedActivities)
          ? body.skippedActivities
          : 0,
      completed:
        typeof body.completedActivities === "number" && Number.isFinite(body.completedActivities)
          ? body.completedActivities
          : 0,
      remaining:
        typeof body.remainingActivities === "number" && Number.isFinite(body.remainingActivities)
          ? body.remainingActivities
          : 0,
      activities: existingActivityList,
      preferences: Array.isArray(body.preferences)
        ? body.preferences.map((v) => String(v)).slice(0, 8)
        : [],
      tripStartDate,
      tripEndDate,
    });

    const actionItems = existingActivityList.map((item) => ({ id: item.id, title: item.title }));

    // Fast path: explicit "update X time to HH:mm" requests are still applied directly.
    if (isTimingUpdateRequest(message) && actionItems.length > 0) {
      const requestedTime = parseTimeFromMessage(message);
      if (requestedTime) {
        const targetId = pickTargetActivityId(message, actionItems);
        if (targetId) {
          const richUpdate = await supabase
            .from("itinerary_items")
            .update({ time: requestedTime, user_modified: true })
            .eq("trip_id", tripId)
            .eq("id", targetId);
          if (richUpdate.error) {
            await supabase
              .from("itinerary_items")
              .update({ time: requestedTime })
              .eq("trip_id", tripId)
              .eq("id", targetId);
          }
          const targetTitle =
            actionItems.find((item) => item.id === targetId)?.title ?? "activity";
          const response = {
            message: `Done. I updated ${targetTitle} to ${requestedTime}.`,
            actions: [
              {
                type: "revise_itinerary" as const,
                label: "Updated activity time",
              },
            ],
            updatedItinerary: [
              { day: date || "", activityId: targetId, title: targetTitle, time: requestedTime },
            ],
            reasoning: "Applied requested timing change directly to itinerary.",
            followUpQuestion: "Want me to rebalance nearby activities too?",
          };
          await supabase.from("ai_conversations").insert({
            trip_id: tripId,
            user_id: user.id,
            intent: "adjust_day",
            message,
            response,
          });
          return NextResponse.json({
            ok: true,
            response,
            applied: true,
          });
        }
      }
    }

    const { data: historyRows } = await supabase
      .from("ai_conversations")
      .select("message, response, created_at")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);

    const truncate = (text: string, max = 600): string =>
      text.length > max ? `${text.slice(0, max - 1)}…` : text;

    const recentTurns = ((historyRows ?? []) as Array<Record<string, unknown>>)
      .slice()
      .reverse()
      .map((row) => {
        const respObj = (row.response ?? {}) as Record<string, unknown>;
        const assistantText = typeof respObj.message === "string" ? respObj.message : "";
        const followUp =
          typeof respObj.followUpQuestion === "string" ? respObj.followUpQuestion : "";
        return {
          user: truncate(typeof row.message === "string" ? row.message : ""),
          assistant: truncate(`${assistantText}${followUp ? ` ${followUp}` : ""}`.trim()),
        };
      })
      .filter((t) => t.user || t.assistant);

    const lastAssistantText = recentTurns.length > 0
      ? recentTurns[recentTurns.length - 1]!.assistant
      : "";
    const pendingFromAssistant = lastAssistantText
      ? detectPendingMutationFromAssistant(lastAssistantText)
      : null;
    const userIsAffirming = isAffirmation(message);
    const explicitMutationKind = detectMutationIntent(message);
    const mutationKind: MutationKind | null =
      explicitMutationKind ?? (userIsAffirming ? pendingFromAssistant : null);

    const mutationInstructions = mutationKind
      ? buildMutationPromptInstructions({
          kind: mutationKind,
          currentDay: date,
          tripStartDate,
          tripEndDate,
        })
      : "";

    const conversationContext = recentTurns.length > 0
      ? recentTurns
          .map((t, idx) =>
            [
              t.user ? `Turn ${idx + 1} - User: ${t.user}` : "",
              t.assistant ? `Turn ${idx + 1} - Assistant: ${t.assistant}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n")
      : "";

    const followThroughInstruction =
      userIsAffirming && pendingFromAssistant
        ? [
            `\nThe user is CONFIRMING the assistant's previous suggestion (see conversation history above).`,
            `Do NOT propose a different change. Execute exactly what was previously suggested:`,
            `- Re-read your last assistant turn, identify the specific places/activities/changes proposed there.`,
            `- Convert each of those into a concrete updatedItinerary entry now (use the schema above).`,
            `- Do not invent unrelated activities. If the previous turn was vague, ask one short clarifying question instead of guessing.`,
          ].join("\n")
        : "";

    let ai: AiStructuredResponse;
    if (contextAwareNow) {
      ai = {
        message: contextAwareNow.message,
        actions: [{ type: "inform" as const, label: "Now suggestion" }],
        updatedItinerary: [],
        reasoning: "Built from current time + today's itinerary context.",
        followUpQuestion: contextAwareNow.followUpQuestion,
      };
    } else {
      const fullPrompt = [
        conversationContext ? `Conversation so far:\n${conversationContext}` : "",
        `Latest user message: ${message}`,
        mutationInstructions ? `\nInstructions:\n${mutationInstructions}` : "",
        followThroughInstruction,
        `\nLive trip context:\n${compactContext}`,
        `\nRespond in 2-3 short practical lines and keep updatedItinerary aligned with the action you describe.`,
      ]
        .filter(Boolean)
        .join("\n");

      ai = await runAdaptiveAi({
        message: fullPrompt,
        context,
        intent: mutationKind ? "adjust_day" : undefined,
      });
    }

    let appliedSummary: ApplyResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      appliedDays: new Set<string>(),
      addedTitles: [],
      updatedTitles: [],
      deletedTitles: [],
    };
    let revisionId: string | null = null;

    const candidateRevisions = Array.isArray(ai.updatedItinerary) ? ai.updatedItinerary : [];
    if (mutationKind && candidateRevisions.length > 0) {
      const itemRowsRich = (items ?? []) as Array<Record<string, unknown>>;
      const toFullActivity = (
        row: Record<string, unknown>,
      ): ItineraryOptimizationActivity => ({
        id: String(row.id ?? ""),
        trip_id: tripId,
        itinerary_day_id:
          row.itinerary_day_id == null
            ? null
            : (row.itinerary_day_id as string | number),
        date:
          typeof row.date === "string"
            ? extractYMD(String(row.date)) ?? String(row.date).trim().slice(0, 10)
            : "",
        title: String(row.title ?? row.activity_name ?? "Activity"),
        location: typeof row.location === "string" ? row.location : "",
        time: typeof row.time === "string" ? row.time : null,
        priority_score:
          typeof row.priority_score === "number" ? row.priority_score : null,
        sunset_sensitive: row.sunset_sensitive === true,
        booking_required: row.booking_required === true,
        ai_generated: row.ai_generated === true,
        user_modified: row.user_modified === true,
      });
      const previousSnapshot: ItineraryOptimizationActivity[] = itemRowsRich.map(toFullActivity);

      appliedSummary = await applyAssistantRevisions({
        supabase,
        tripId,
        userId: user.id,
        fallbackDate: date,
        tripStartDate,
        tripEndDate,
        existingActivities: existingActivityMap,
        revisions: candidateRevisions,
      });

      if (appliedSummary.added + appliedSummary.updated + appliedSummary.deleted > 0) {
        const updatedActivities: ItineraryOptimizationActivity[] = [];
        const reloadDates = Array.from(appliedSummary.appliedDays);
        if (reloadDates.length > 0) {
          const runReload = async (select: string) =>
            await supabase
              .from("itinerary_items")
              .select(select)
              .eq("trip_id", tripId)
              .in("date", reloadDates)
              .order("time", { ascending: true });
          let reloadResult = (await runReload(richSelect)) as {
            data: Array<Record<string, unknown>> | null;
            error: { message?: string } | null;
          };
          if (reloadResult.error) {
            reloadResult = (await runReload(fallbackSelect)) as {
              data: Array<Record<string, unknown>> | null;
              error: { message?: string } | null;
            };
          }
          for (const row of (reloadResult.data ?? []) as Array<Record<string, unknown>>) {
            updatedActivities.push(toFullActivity(row));
          }
        }

        revisionId = await createItineraryRevision({
          supabase,
          tripId,
          revisionReason: `assistant_chat:${mutationKind}`,
          previous: { activities: previousSnapshot },
          updated: { activities: updatedActivities },
        });
      }
    }

    const totalApplied =
      appliedSummary.added + appliedSummary.updated + appliedSummary.deleted;

    if (mutationKind && totalApplied > 0) {
      const dayLabel = appliedSummary.appliedDays.size === 1
        ? Array.from(appliedSummary.appliedDays)[0]
        : "";
      const summaryParts: string[] = [];
      if (appliedSummary.added > 0) {
        const titles = appliedSummary.addedTitles.slice(0, 3).join(", ");
        summaryParts.push(
          titles ? `Added ${titles}` : `Added ${appliedSummary.added}`,
        );
      }
      if (appliedSummary.updated > 0) {
        const titles = appliedSummary.updatedTitles.slice(0, 3).join(", ");
        summaryParts.push(
          titles ? `Updated ${titles}` : `Updated ${appliedSummary.updated}`,
        );
      }
      if (appliedSummary.deleted > 0) {
        const titles = appliedSummary.deletedTitles.slice(0, 3).join(", ");
        summaryParts.push(
          titles ? `Removed ${titles}` : `Removed ${appliedSummary.deleted}`,
        );
      }
      const summary = summaryParts.join(". ");
      const dayClause = dayLabel ? ` for ${dayLabel}` : "";
      ai = {
        ...ai,
        message: `Done${dayClause}. ${summary}.`.replace(/\s+\./g, ".").trim(),
      };
    } else if (mutationKind && candidateRevisions.length > 0 && totalApplied === 0) {
      ai = {
        ...ai,
        message: `${ai.message ? `${ai.message} ` : ""}I couldn't apply the change — please try rephrasing (e.g. specify the day, time, or which activity).`.trim(),
      };
    }

    await supabase.from("ai_conversations").insert({
      trip_id: tripId,
      user_id: user.id,
      intent: mutationKind ? "adjust_day" : ai.actions?.[0]?.type ?? "conversational",
      message,
      response: ai,
    });

    return NextResponse.json({
      ok: true,
      response: ai,
      applied: totalApplied > 0,
      revisionId,
      changes: {
        added: appliedSummary.added,
        updated: appliedSummary.updated,
        deleted: appliedSummary.deleted,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Assistant unavailable";
    return NextResponse.json({ ok: false, error: reason }, { status: 422 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, message, response, created_at")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message || "Could not load chat history." }, { status: 422 });
  }

  const items = (data ?? [])
    .slice()
    .reverse()
    .flatMap((row) => {
      const response = (row.response ?? {}) as Record<string, unknown>;
      const assistantText = typeof response.message === "string" ? response.message : "";
      const followUp = typeof response.followUpQuestion === "string" ? response.followUpQuestion : "";
      return [
        { id: `${row.id}-u`, role: "user", text: String(row.message ?? "") },
        {
          id: `${row.id}-a`,
          role: "assistant",
          text: `${assistantText}${followUp ? ` ${followUp}` : ""}`.trim(),
        },
      ];
    })
    .filter((m) => m.text.length > 0);

  return NextResponse.json({ ok: true, messages: items });
}
