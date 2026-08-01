import { NextResponse } from "next/server";
import { buildAiTripContext, runAdaptiveAi } from "@/lib/ai";
import { revisionsToProposedEdits } from "@/lib/ai/apply-itinerary-revisions";
import type { ItineraryEditIntent, ItineraryEditProposal } from "@/lib/chat/itinerary-edit-types";
import type {
  AiStructuredResponse,
} from "@/lib/ai/types";
import { buildChatRetrievalContext } from "@/lib/chat/context-builder";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { extractYMD } from "@/lib/itinerary-trip-range";
import { executeTool } from "@/lib/tools/execute";
import { registerDefaultTools } from "@/lib/tools/register-defaults";
import {
  ensureTripMemory,
  saveTripMemory,
  updateTripMemoryFromUserMessage,
  type TripMemory,
} from "@/lib/trip-memory";
import {
  emptyUserTravelMemory,
  ensureUserTravelMemory,
  harvestUserTravelMemoryFromMessage,
  saveUserTravelMemory,
  type UserTravelMemory,
} from "@/lib/user-travel-memory";

registerDefaultTools();

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

/** Full regenerations go through generate_itinerary — not free-text schedules. */
function isFullItineraryGenerationRequest(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (!text) return false;
  const wantsGenerate =
    /\b(generate|create|build|make|plan|rebuild|regenerate|replace)\b/.test(text) ||
    /\b(full|new|another)\s+(itinerary|schedule|day[- ]by[- ]day)\b/.test(text);
  const mentionsItinerary =
    /\b(itinerary|day[- ]by[- ]day|full\s+plan|whole\s+(trip|plan)|entire\s+(trip|plan))\b/.test(
      text,
    );
  return wantsGenerate && mentionsItinerary;
}

function isReplaceExistingAffirmation(message: string, lastAssistantText: string): boolean {
  if (!isAffirmation(message)) return false;
  const v = lastAssistantText.toLowerCase();
  return (
    /replace|overwrite|regenerate|existing itinerary|replaceexisting/i.test(v) ||
    /already has an itinerary/i.test(v)
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

  // Trip memory must be loaded before any AI response.
  let tripMemory: TripMemory = await ensureTripMemory(supabase, tripId).catch(() => ({
    trip_id: tripId,
    budget: null,
    hotel_preference: null,
    food_preference: null,
    flight_preference: null,
    interests: [],
    visited_places: [],
    packing_preferences: [],
    emergency_contacts: [],
    updated_at: new Date().toISOString(),
  }));
  try {
    const extracted = await updateTripMemoryFromUserMessage({
      current: tripMemory,
      userMessage: message,
    });
    tripMemory = await saveTripMemory(supabase, tripId, extracted);
  } catch {
    // Auto-update is best-effort
  }

  // Cross-trip user travel memory — isolated from trip_memory.
  let userTravelMemory: UserTravelMemory = emptyUserTravelMemory(user.id);
  try {
    userTravelMemory = await ensureUserTravelMemory(supabase, user.id);
    const harvested = await harvestUserTravelMemoryFromMessage({
      current: userTravelMemory,
      userMessage: message,
    });
    userTravelMemory = await saveUserTravelMemory(supabase, user.id, harvested);
  } catch {
    // Best-effort
  }

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
    userTravelMemory: {
      favorite_destinations: userTravelMemory.favorite_destinations,
      hotel_type: userTravelMemory.hotel_type,
      budget_range: userTravelMemory.budget_range,
      travel_style: userTravelMemory.travel_style,
      preferred_airlines: userTravelMemory.preferred_airlines,
      preferred_food: userTravelMemory.preferred_food,
      travel_pace: userTravelMemory.travel_pace,
    },
    travelerPreferences: {
      interests: [
        ...(Array.isArray(body.preferences)
          ? body.preferences.map((v) => String(v)).slice(0, 8)
          : []),
        ...tripMemory.interests,
      ].slice(0, 12),
      pace:
        body.tripPace === "relaxed" || body.tripPace === "balanced" || body.tripPace === "packed"
          ? body.tripPace
          : "balanced",
      foodPreferences: tripMemory.food_preference
        ? [tripMemory.food_preference]
        : undefined,
    },
    budget: tripMemory.budget
      ? { level: "unknown", currency: tripMemory.budget }
      : undefined,
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
      preferences: [
        ...(Array.isArray(body.preferences)
          ? body.preferences.map((v) => String(v)).slice(0, 8)
          : []),
        ...tripMemory.interests,
      ].slice(0, 12),
      tripStartDate,
      tripEndDate,
    });

    // Relevance-filtered slices (expenses / docs / members / guide) — shared Context Builder.
    let retrievedContext = "";
    try {
      const built = await buildChatRetrievalContext({
        supabase,
        userId: user.id,
        userMessage: message,
        tripId,
        tripMemory,
        mode: "trip_slices",
        // Itinerary already in compactContext — skip companion re-fetch.
        skipCompanion: true,
        destinationHint: destination,
      });
      retrievedContext = built.promptBlock;
    } catch {
      // Best-effort — assistant still works with compact itinerary context.
    }

    const actionItems = existingActivityList.map((item) => ({ id: item.id, title: item.title }));

    // Fast path: explicit "update X time to HH:mm" — propose for confirmation (do not auto-apply).
    if (isTimingUpdateRequest(message) && actionItems.length > 0) {
      const requestedTime = parseTimeFromMessage(message);
      if (requestedTime) {
        const targetId = pickTargetActivityId(message, actionItems);
        if (targetId) {
          const targetTitle =
            actionItems.find((item) => item.id === targetId)?.title ?? "activity";
          const day = date || existingActivityMap.get(targetId)?.date || "";
          const proposal: ItineraryEditProposal = {
            proposalId: crypto.randomUUID(),
            tripId,
            intent: "move_activity",
            summary: `Update ${targetTitle} to ${requestedTime}`,
            rationale: "Timing change from your request",
            edits: [
              {
                op: "update",
                day,
                activityId: targetId,
                title: targetTitle,
                time: requestedTime,
                label: `Update “${targetTitle}” → ${requestedTime}`,
              },
            ],
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          const response = {
            message: `I can update ${targetTitle} to ${requestedTime}. Confirm below to apply — nothing is saved until you tap Apply.`,
            actions: [
              {
                type: "revise_itinerary" as const,
                label: "Proposed activity time",
              },
            ],
            updatedItinerary: [
              { day, activityId: targetId, title: targetTitle, time: requestedTime },
            ],
            reasoning: "Proposed timing change; awaiting user confirmation.",
            followUpQuestion: "Want me to rebalance nearby activities too?",
          };
          await supabase.from("ai_conversations").insert({
            trip_id: tripId,
            user_id: user.id,
            intent: "adjust_day",
            message,
            response: { ...response, itineraryProposal: proposal },
          });
          return NextResponse.json({
            ok: true,
            response,
            applied: false,
            proposal,
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

    // Full itinerary generation via generate_itinerary tool (writes itinerary_* tables).
    const wantsFullGenerate =
      isFullItineraryGenerationRequest(message) ||
      isReplaceExistingAffirmation(message, lastAssistantText);
    if (wantsFullGenerate) {
      const prefs = Array.isArray(body.preferences)
        ? body.preferences.map((v) => String(v)).filter(Boolean).slice(0, 8)
        : [];
      const paceRaw =
        body.tripPace === "relaxed" || body.tripPace === "balanced" || body.tripPace === "packed"
          ? body.tripPace
          : undefined;
      const replaceExisting =
        /\breplace|overwrite|regenerate|rebuild\b/i.test(message) ||
        isReplaceExistingAffirmation(message, lastAssistantText);

      const toolResult = await executeTool({
        name: "generate_itinerary",
        args: {
          tripId,
          preferences: prefs.join(", ") || undefined,
          pace: paceRaw,
          replaceExisting,
        },
        ctx: { userId: user.id, tripId },
      });

      const toolData =
        toolResult.ok && toolResult.data && typeof toolResult.data === "object"
          ? (toolResult.data as {
              status?: string;
              message?: string;
              activityCount?: number;
              dayCount?: number;
            })
          : null;

      const response =
        toolResult.ok && toolData?.status === "generated"
          ? {
              message:
                toolData.message ||
                "Itinerary generated and saved. Open the Itinerary tab to review it.",
              actions: [{ type: "revise_itinerary" as const, label: "Generated itinerary" }],
              updatedItinerary: [],
              reasoning: "Invoked generate_itinerary tool to persist itinerary days/items.",
              followUpQuestion: "Want any day adjusted?",
            }
          : toolResult.ok && toolData?.status === "needs_confirmation"
            ? {
                message:
                  toolData.message ||
                  "This trip already has an itinerary. Confirm if you want me to replace it.",
                actions: [{ type: "inform" as const, label: "Confirm replace" }],
                updatedItinerary: [],
                reasoning: "generate_itinerary requires replaceExisting confirmation.",
                followUpQuestion: "Reply yes to replace the existing itinerary.",
              }
            : {
                message: toolResult.ok
                  ? toolData?.message || "Could not generate itinerary."
                  : toolResult.error || "Could not generate itinerary.",
                actions: [{ type: "inform" as const, label: "Generation failed" }],
                updatedItinerary: [],
                reasoning: "generate_itinerary tool returned an error.",
                followUpQuestion: "Want to try again with different preferences?",
              };

      await supabase.from("ai_conversations").insert({
        trip_id: tripId,
        user_id: user.id,
        intent: "plan_day",
        message,
        response,
      });

      return NextResponse.json({
        ok: true,
        response,
        applied: toolResult.ok && toolData?.status === "generated",
      });
    }

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
        retrievedContext
          ? `\nRetrieved trip context (relevance-filtered):\n${retrievedContext}`
          : "",
        `\nRespond in 2-3 short practical lines and keep updatedItinerary aligned with the action you describe.`,
      ]
        .filter(Boolean)
        .join("\n");

      ai = await runAdaptiveAi({
        message: fullPrompt,
        context,
        intent: mutationKind ? "adjust_day" : undefined,
        tripMemory,
      });
    }

    let itineraryProposal: ItineraryEditProposal | null = null;

    const candidateRevisions = Array.isArray(ai.updatedItinerary) ? ai.updatedItinerary : [];
    if (mutationKind && candidateRevisions.length > 0) {
      const intentMap: Record<MutationKind, ItineraryEditIntent> = {
        add: "add_activity",
        delete: "delete_activity",
        update: "move_activity",
      };
      const edits = revisionsToProposedEdits(candidateRevisions);
      if (edits.length > 0) {
        itineraryProposal = {
          proposalId: crypto.randomUUID(),
          tripId,
          intent: intentMap[mutationKind],
          summary:
            ai.message?.trim() ||
            `Proposed ${mutationKind} for ${edits.length} activit${edits.length === 1 ? "y" : "ies"}`,
          rationale: ai.reasoning?.trim() || undefined,
          edits,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        ai = {
          ...ai,
          message: `${ai.message ? `${ai.message} ` : ""}Review the proposed changes below and tap Apply to update your itinerary — nothing is saved until you confirm.`.trim(),
        };
      } else {
        ai = {
          ...ai,
          message: `${ai.message ? `${ai.message} ` : ""}I couldn't build a concrete edit proposal — please try rephrasing (e.g. specify the day, time, or which activity).`.trim(),
        };
      }
    }

    await supabase.from("ai_conversations").insert({
      trip_id: tripId,
      user_id: user.id,
      intent: mutationKind ? "adjust_day" : ai.actions?.[0]?.type ?? "conversational",
      message,
      response: {
        ...ai,
        ...(itineraryProposal ? { itineraryProposal } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      response: ai,
      applied: false,
      proposal: itineraryProposal,
      revisionId: null,
      changes: {
        added: 0,
        updated: 0,
        deleted: 0,
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
