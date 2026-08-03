import { streamChatCompletion } from "@/lib/chat/gemini-stream";
import {
  buildConversationLabel,
  conversationLabelIsReady,
} from "@/lib/chat/conversation-label";
import {
  streamChatCompletionWithTools,
  type ChatToolCallRecord,
  type ChatToolsStreamResult,
} from "@/lib/chat/gemini-tools";
import type { ItineraryEditProposal } from "@/lib/chat/itinerary-edit-types";
import type { ProposeItineraryEditsOutput } from "@/lib/tools/definitions/propose-itinerary-edits";
import {
  applyDiscoveryState,
  resolveDiscoveryPhase,
} from "@/lib/chat/discovery-agent";
import { buildChatDestinationCards } from "@/lib/chat/destination-cards";
import { buildChatPlaceCardsFromEntities } from "@/lib/places/place-enrichment-service";
import type { ChatPlaceCard } from "@/lib/places/types";
import { extractPlacesHeuristic } from "@/lib/places/place-extractor";
import type { ChatEntity, StructuredChatResponse } from "@/lib/chat/structured-response";
import {
  mergeChatEntities,
  parseStructuredChatResponse,
  stripEntityMarkup,
} from "@/lib/chat/structured-response";
import {
  ensureConversationMemory,
  harvestCandidateDestinations,
  loadConversationMemory,
  mergeMemoryFields,
  saveConversationMemory,
  updateMemoryFromUserMessage,
} from "@/lib/chat/memory";
import { emptyConversationMemory } from "@/lib/chat/memory-types";
import { buildChatRetrievalContext } from "@/lib/chat/context-builder";
import { buildChatSystemPrompt } from "@/lib/chat/prompts";
import type { UserLocationPromptContext } from "@/lib/location/types";
import {
  detectDestinationKnowledgeIntent,
  resolveDestinationSlugs,
  retrieveDestinationKnowledge,
} from "@/lib/destination-knowledge";
import type { ChatStreamEvent } from "@/lib/chat/types";
import { asHistoryRole, asMessageRow } from "@/lib/chat/guards";
import { loadTripCompanionContext } from "@/lib/chat/trip-companion";
import type { TripCompanionContext } from "@/lib/chat/trip-companion";
import { ensureTripConversation } from "@/lib/chat/trip-conversation";
import {
  emptyTripMemory,
  ensureTripMemory,
  loadTripMemory,
  resolveTripIdForConversation,
  saveTripMemory,
  updateTripMemoryFromUserMessage,
  type TripMemory,
} from "@/lib/trip-memory";
import {
  emptyUserTravelMemory,
  ensureUserTravelMemory,
  harvestUserTravelMemoryFromMessage,
  loadUserTravelMemory,
  promoteDurablePrefsFromConversation,
  saveUserTravelMemory,
  type UserTravelMemory,
} from "@/lib/user-travel-memory";
import { chatLogger, createRequestId } from "@/lib/observability/logger";
import { checkChatRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import "@/lib/tools";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Soft cap on knowledge context injected into the system prompt (chars). */
const KNOWLEDGE_CONTEXT_MAX_CHARS = 12_000;

/** Tools exposed to trip-scoped companion chat. */
const TRIP_CHAT_TOOL_NAMES = [
  "generate_itinerary",
  "propose_itinerary_edits",
  "get_companion_context",
  "query_guide",
  "get_trip_memory",
  "update_trip_memory",
] as const;
type ChatPostBody = {
  message?: unknown;
  conversationId?: unknown;
  /** When set, message is sent on the trip's single owned conversation. */
  tripId?: unknown;
  /** Re-run the assistant on an existing conversation without inserting another user message. */
  regenerate?: unknown;
  /**
   * Optional city/state/country for personalization (client-side LocationService).
   * Coordinates must never be sent here.
   */
  userLocation?: unknown;
};

function encodeSse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Accept only city/state/country — strip any accidental coordinates from the client. */
function parseUserLocationContext(raw: unknown): UserLocationPromptContext | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  // Ignore accidental lat/lng if a client ever sends them
  const city = typeof o.city === "string" ? o.city.trim() || null : null;
  const state = typeof o.state === "string" ? o.state.trim() || null : null;
  const country = typeof o.country === "string" ? o.country.trim() || null : null;
  if (!city && !state && !country) return null;
  return { city, state, country };
}

async function loadProfileLocationContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<UserLocationPromptContext | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "location_lat, location_lng, location_city, location_state, location_country, location_enabled",
      )
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    if (data.location_enabled === false) return null;

    let city =
      typeof data.location_city === "string" ? data.location_city.trim() || null : null;
    let state =
      typeof data.location_state === "string" ? data.location_state.trim() || null : null;
    let country =
      typeof data.location_country === "string"
        ? data.location_country.trim() || null
        : null;

    // Coords saved but labels missing — reverse-geocode once for the prompt
    const lat =
      typeof data.location_lat === "number" && Number.isFinite(data.location_lat)
        ? data.location_lat
        : null;
    const lng =
      typeof data.location_lng === "number" && Number.isFinite(data.location_lng)
        ? data.location_lng
        : null;

    if ((!city && !state && !country) && lat != null && lng != null) {
      try {
        const { reverseGeocodeServer } = await import("@/lib/location/geocoder-server");
        const geo = await reverseGeocodeServer(lat, lng);
        city = geo.city;
        state = geo.state;
        country = geo.country;
        // Best-effort persist labels for next time
        if (city || state || country) {
          void supabase
            .from("profiles")
            .update({
              location_city: city,
              location_state: state,
              location_country: country,
              location_updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
        }
      } catch {
        /* keep null */
      }
    }

    if (!city && !state && !country) return null;
    return { city, state, country };
  } catch {
    return null;
  }
}

/** Prefer client-provided context; fall back to profile. */
async function resolveUserLocationForPrompt(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  bodyLocation: unknown,
): Promise<UserLocationPromptContext | null> {
  return (
    parseUserLocationContext(bodyLocation) ??
    (await loadProfileLocationContext(supabase, userId))
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const tripId = req.nextUrl.searchParams.get("tripId")?.trim() || "";
  if (tripId) {
    const ensured = await ensureTripConversation(supabase, {
      tripId,
      userId: user.id,
    });
    if (!ensured.ok) {
      return Response.json({ ok: false, error: ensured.error }, { status: ensured.status });
    }

    const conversationId = ensured.conversation.id;
    const { data: messages, error: msgError } = await supabase
      .from("conversation_messages")
      .select("id, conversation_id, role, content, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgError) {
      return Response.json({ ok: false, error: msgError.message }, { status: 500 });
    }

    const memory = await loadConversationMemory(supabase, conversationId);
    const tripMemory = await loadTripMemory(supabase, tripId).catch(() =>
      emptyTripMemory(tripId),
    );
    const userTravelMemory = await loadUserTravelMemory(supabase, user.id).catch(() =>
      emptyUserTravelMemory(user.id),
    );
    return Response.json({
      ok: true,
      conversation: ensured.conversation,
      messages: (messages ?? []).map(asMessageRow),
      memory,
      tripMemory,
      userTravelMemory,
    });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId")?.trim() || "";
  if (!conversationId) {
    // Standalone list only — trip-owned conversations live on the trip Chat tab.
    let query = supabase
      .from("conversations")
      .select("id, user_id, title, created_at, updated_at, trip_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    let { data, error } = await query.is("trip_id", null);
    if (error && /trip_id|schema cache|PGRST|column/i.test(error.message)) {
      const fallback = await supabase
        .from("conversations")
        .select("id, user_id, title, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);
      data = fallback.data as typeof data;
      error = fallback.error;
    }

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true, conversations: data ?? [] });
  }

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, user_id, title, created_at, updated_at, trip_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convError && /trip_id|schema cache|PGRST|column/i.test(convError.message)) {
    const fallback = await supabase
      .from("conversations")
      .select("id, user_id, title, created_at, updated_at")
      .eq("id", conversationId)
      .maybeSingle();
    if (fallback.error) {
      return Response.json({ ok: false, error: fallback.error.message }, { status: 500 });
    }
    if (!fallback.data || fallback.data.user_id !== user.id) {
      return Response.json({ ok: false, error: "Conversation not found" }, { status: 404 });
    }
    const { data: messages, error: msgError } = await supabase
      .from("conversation_messages")
      .select("id, conversation_id, role, content, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (msgError) {
      return Response.json({ ok: false, error: msgError.message }, { status: 500 });
    }
    const memory = await loadConversationMemory(supabase, conversationId);
    const userTravelMemory = await loadUserTravelMemory(supabase, user.id).catch(() =>
      emptyUserTravelMemory(user.id),
    );
    return Response.json({
      ok: true,
      conversation: fallback.data,
      messages: (messages ?? []).map(asMessageRow),
      memory,
      userTravelMemory,
    });
  }

  if (convError) {
    return Response.json({ ok: false, error: convError.message }, { status: 500 });
  }
  if (!conversation) {
    return Response.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  const isOwner = conversation.user_id === user.id;
  const tripOwned =
    typeof conversation.trip_id === "string" && conversation.trip_id.trim().length > 0
      ? conversation.trip_id.trim()
      : "";
  if (!isOwner) {
    if (!tripOwned || !(await isTripMember(supabase, tripOwned, user.id))) {
      return Response.json({ ok: false, error: "Conversation not found" }, { status: 404 });
    }
  }

  const { data: messages, error: msgError } = await supabase
    .from("conversation_messages")
    .select("id, conversation_id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgError) {
    return Response.json({ ok: false, error: msgError.message }, { status: 500 });
  }

  const memory = await loadConversationMemory(supabase, conversationId);
  const userTravelMemory = await loadUserTravelMemory(supabase, user.id).catch(() =>
    emptyUserTravelMemory(user.id),
  );

  return Response.json({
    ok: true,
    conversation,
    messages: (messages ?? []).map(asMessageRow),
    memory,
    userTravelMemory,
  });
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkChatRateLimit(user.id);
  if (!rate.allowed) {
    chatLogger.warn("chat_rate_limited", {
      requestId,
      userId: user.id,
      remaining: rate.remaining,
      retryAfterMs: rate.retryAfterMs,
    });
    return rateLimitResponse(rate);
  }

  let body: ChatPostBody;
  try {
    body = (await req.json()) as ChatPostBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const regenerate = body.regenerate === true;
  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  if (!regenerate && !message) {
    return Response.json({ ok: false, error: "Message is required" }, { status: 400 });
  }
  if (message.length > 8000) {
    return Response.json({ ok: false, error: "Message is too long" }, { status: 400 });
  }

  chatLogger.info("chat_request", {
    requestId,
    userId: user.id,
    regenerate,
    messageLength: message.length,
    hasConversationId: typeof body.conversationId === "string" && Boolean(body.conversationId),
    hasTripId: typeof body.tripId === "string" && Boolean(body.tripId),
    hasClientUserLocation: Boolean(parseUserLocationContext(body.userLocation)),
    rateRemaining: rate.remaining,
  });

  const requestedConversationId =
    typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  const requestedTripId = typeof body.tripId === "string" ? body.tripId.trim() : "";

  if (regenerate && !requestedConversationId && !requestedTripId) {
    return Response.json(
      { ok: false, error: "conversationId is required to regenerate" },
      { status: 400 },
    );
  }

  let conversationId = requestedConversationId;
  let conversationTitle = "New chat";
  let activeTripId = requestedTripId;
  let userMessageRow: {
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    metadata: unknown;
    created_at: string;
  } | null = null;

  if (requestedTripId) {
    const ensured = await ensureTripConversation(supabase, {
      tripId: requestedTripId,
      userId: user.id,
      attachConversationId: requestedConversationId || null,
    });
    if (!ensured.ok) {
      return Response.json({ ok: false, error: ensured.error }, { status: ensured.status });
    }
    conversationId = ensured.conversation.id;
    conversationTitle = ensured.conversation.title;
    activeTripId = requestedTripId;
  } else if (conversationId) {
    const { data: existing, error } = await supabase
      .from("conversations")
      .select("id, title, user_id, trip_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (error && /trip_id|schema cache|PGRST|column/i.test(error.message)) {
      const fallback = await supabase
        .from("conversations")
        .select("id, title, user_id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (fallback.error) {
        return Response.json({ ok: false, error: fallback.error.message }, { status: 500 });
      }
      if (!fallback.data) {
        return Response.json({ ok: false, error: "Conversation not found" }, { status: 404 });
      }
      conversationTitle = fallback.data.title;
    } else if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    } else if (!existing) {
      return Response.json({ ok: false, error: "Conversation not found" }, { status: 404 });
    } else {
      const isOwner = existing.user_id === user.id;
      const tripOwned =
        typeof existing.trip_id === "string" && existing.trip_id.trim()
          ? existing.trip_id.trim()
          : "";
      if (!isOwner) {
        if (!tripOwned || !(await isTripMember(supabase, tripOwned, user.id))) {
          return Response.json({ ok: false, error: "Conversation not found" }, { status: 404 });
        }
      }
      conversationTitle = existing.title;
      if (tripOwned) activeTripId = tripOwned;
    }
  } else {
    // Standalone new chat (not trip-owned)
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New chat" })
      .select("id, title")
      .single();
    if (error || !created) {
      return Response.json(
        { ok: false, error: error?.message || "Failed to create conversation" },
        { status: 500 },
      );
    }
    conversationId = created.id;
    conversationTitle = created.title;
  }

  if (!activeTripId) {
    activeTripId =
      (await resolveTripIdForConversation(supabase, conversationId).catch(() => null)) || "";
  }

  if (!regenerate) {
    const { data, error: userMsgError } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        content: message,
        metadata: {},
      })
      .select("id, conversation_id, role, content, metadata, created_at")
      .single();

    if (userMsgError || !data) {
      return Response.json(
        { ok: false, error: userMsgError?.message || "Failed to save message" },
        { status: 500 },
      );
    }
    userMessageRow = data;
  } else {
    // Replace trailing assistant reply/replies for this turn.
    const { data: recent, error: recentError } = await supabase
      .from("conversation_messages")
      .select("id, role")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (recentError) {
      return Response.json({ ok: false, error: recentError.message }, { status: 500 });
    }

    const idsToDelete: string[] = [];
    for (const row of recent ?? []) {
      if (row.role !== "assistant") break;
      idsToDelete.push(row.id as string);
    }
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("conversation_messages")
        .delete()
        .in("id", idsToDelete);
      if (deleteError) {
        return Response.json({ ok: false, error: deleteError.message }, { status: 500 });
      }
    }
  }

  const { data: historyRows, error: historyError } = await supabase
    .from("conversation_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40);

  if (historyError) {
    return Response.json({ ok: false, error: historyError.message }, { status: 500 });
  }

  const history = (historyRows ?? [])
    .map((row) => {
      const role = asHistoryRole(row.role);
      if (!role) return null;
      const content = typeof row.content === "string" ? row.content : "";
      return { role, content };
    })
    .filter((row): row is { role: "user" | "assistant"; content: string } => row !== null);

  if (history.length === 0) {
    return Response.json({ ok: false, error: "No messages to reply to" }, { status: 400 });
  }

  // Conversation-scoped memory + Discovery Agent state.
  let memory = emptyConversationMemory(conversationId);
  try {
    memory = await ensureConversationMemory(supabase, conversationId);
    if (!regenerate && message) {
      const extracted = await updateMemoryFromUserMessage({
        current: memory,
        userMessage: message,
        signal: req.signal,
      });
      const withDiscovery = applyDiscoveryState(extracted, message);
      memory = await saveConversationMemory(supabase, conversationId, withDiscovery);
    } else {
      memory = await loadConversationMemory(supabase, conversationId);
      const lastUser = [...history].reverse().find((h) => h.role === "user");
      if (lastUser) {
        const withDiscovery = applyDiscoveryState(memory, lastUser.content);
        if (
          withDiscovery.discovery_active !== memory.discovery_active ||
          withDiscovery.discovery_phase !== memory.discovery_phase
        ) {
          memory = await saveConversationMemory(supabase, conversationId, withDiscovery);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return Response.json({ ok: false, error: "Cancelled" }, { status: 499 });
    }
    // Memory is best-effort — continue chat with whatever we have
    memory = await loadConversationMemory(supabase, conversationId).catch(() =>
      emptyConversationMemory(conversationId),
    );
  }

  // Trip-scoped memory — load (and optionally auto-update) before generating a reply.
  let tripMemory: TripMemory | null = null;
  let companionContext: TripCompanionContext | null = null;
  if (activeTripId) {
    try {
      tripMemory = await ensureTripMemory(supabase, activeTripId);
      if (!regenerate && message) {
        const extractedTrip = await updateTripMemoryFromUserMessage({
          current: tripMemory,
          userMessage: message,
          signal: req.signal,
        });
        tripMemory = await saveTripMemory(supabase, activeTripId, extractedTrip);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return Response.json({ ok: false, error: "Cancelled" }, { status: 499 });
      }
      tripMemory = await loadTripMemory(supabase, activeTripId).catch(() =>
        emptyTripMemory(activeTripId),
      );
    }

    try {
      companionContext = await loadTripCompanionContext(supabase, activeTripId);
      // Prefer freshly updated trip memory over the companion snapshot's copy.
      if (companionContext && tripMemory) {
        companionContext = { ...companionContext, tripMemory };
      }
    } catch {
      companionContext = null;
    }
  }

  // Cross-trip User Travel Memory — isolated from trip_memory / conversation_memory.
  let userTravelMemory: UserTravelMemory = emptyUserTravelMemory(user.id);
  try {
    userTravelMemory = await ensureUserTravelMemory(supabase, user.id);
    if (!regenerate && message) {
      const harvested = await harvestUserTravelMemoryFromMessage({
        current: userTravelMemory,
        userMessage: message,
        signal: req.signal,
      });
      // Promote only durable fields from conversation prefs (never trip-only facts).
      const promoted = promoteDurablePrefsFromConversation({
        userMemory: harvested,
        conversationFoodPreferences: memory.food_preferences,
        conversationBudget: memory.budget,
        conversationTransport: memory.transport_preference,
      });
      userTravelMemory = await saveUserTravelMemory(supabase, user.id, promoted);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return Response.json({ ok: false, error: "Cancelled" }, { status: 499 });
    }
    userTravelMemory = await loadUserTravelMemory(supabase, user.id).catch(() =>
      emptyUserTravelMemory(user.id),
    );
  }

  // Destination Knowledge RAG (independent from trip planning).
  const questionForKnowledge =
    (!regenerate && message) ||
    [...history].reverse().find((h) => h.role === "user")?.content ||
    "";
  const knowledgeMode = Boolean(
    questionForKnowledge && detectDestinationKnowledgeIntent(questionForKnowledge),
  );

  let knowledgeContext = "";
  if (knowledgeMode || memory.preferred_destination || memory.candidate_destinations.length > 0) {
    try {
      const destinationSlugs = resolveDestinationSlugs([
        ...(memory.preferred_destination ? [memory.preferred_destination] : []),
        ...memory.candidate_destinations,
      ]);
      const retrieval = await retrieveDestinationKnowledge({
        question: questionForKnowledge || "destination overview",
        destinationSlugs: destinationSlugs.length ? destinationSlugs : undefined,
        signal: req.signal,
        topK: knowledgeMode ? 8 : 4,
      });
      knowledgeContext =
        retrieval.contextText.length > KNOWLEDGE_CONTEXT_MAX_CHARS
          ? `${retrieval.contextText.slice(0, KNOWLEDGE_CONTEXT_MAX_CHARS)}\n…`
          : retrieval.contextText;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return Response.json({ ok: false, error: "Cancelled" }, { status: 499 });
      }
      // Knowledge is best-effort
      chatLogger.warn("chat_knowledge_failed", { requestId, error });
    }
  }

  // Retrieval-filtered trip slices (expenses / docs / members / guide / matched itinerary).
  // Conversation memory, companion, trip memory, and knowledge stay in buildChatSystemPrompt.
  let retrievedContext = "";
  try {
    const built = await buildChatRetrievalContext({
      supabase,
      userId: user.id,
      userMessage: questionForKnowledge || message,
      tripId: activeTripId || null,
      conversationId,
      companion: companionContext,
      tripMemory,
      signal: req.signal,
      mode: "trip_slices",
    });
    retrievedContext = built.promptBlock;
    // Prefer builder companion when route did not load one (standalone → no-op).
    if (!companionContext && built.companion) {
      companionContext = built.companion;
    }
    chatLogger.info("chat_context_built", {
      requestId,
      tripScoped: built.tripScoped,
      charsUsed: built.charsUsed,
      sections: built.sections
        .filter((s) => s.included)
        .map((s) => s.id),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return Response.json({ ok: false, error: "Cancelled" }, { status: 499 });
    }
    chatLogger.warn("chat_context_builder_failed", { requestId, error });
  }

  const resolvedUserLocation = await resolveUserLocationForPrompt(
    supabase,
    user.id,
    body.userLocation,
  );

  chatLogger.info("chat_stream_start", {
    requestId,
    conversationId,
    tripId: activeTripId || null,
    historyTurns: history.length,
    knowledgeMode,
    knowledgeChars: knowledgeContext.length,
    retrievedChars: retrievedContext.length,
    discoveryActive: memory.discovery_active,
    discoveryPhase: memory.discovery_phase,
    hasCompanion: Boolean(companionContext),
    hasUserLocation: Boolean(resolvedUserLocation),
    userLocationCity: resolvedUserLocation?.city ?? null,
  });

  const systemPrompt = buildChatSystemPrompt(memory, {
    knowledgeContext,
    knowledgeMode: knowledgeMode && !memory.discovery_active && !companionContext,
    companionContext,
    tripMemory,
    userTravelMemory,
    retrievedContext,
    userLocation: resolvedUserLocation,
  });

  const signal = req.signal;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        if (signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(encodeSse(event)));
        } catch {
          // Controller may already be closed after cancel
        }
      };

      let assistantText = "";

      try {
        send({
          type: "conversation",
          conversation: { id: conversationId, title: conversationTitle },
        });
        if (userMessageRow) {
          send({ type: "user_message", message: asMessageRow(userMessageRow) });
        }
        send({ type: "memory", memory });
        if (tripMemory) {
          send({ type: "trip_memory", memory: tripMemory });
        }

        const completion =
          activeTripId
            ? streamChatCompletionWithTools({
                systemPrompt,
                history,
                toolNames: [...TRIP_CHAT_TOOL_NAMES],
                toolContext: {
                  userId: user.id,
                  conversationId,
                  tripId: activeTripId,
                  signal,
                  meta: { supabase },
                },
                signal,
              })
            : streamChatCompletion({
                systemPrompt,
                history,
                signal,
              });

        let toolCalls: ChatToolCallRecord[] = [];
        let structuredEntities: ChatEntity[] = [];
        if (activeTripId) {
          const toolIter = completion as AsyncGenerator<
            string,
            ChatToolsStreamResult,
            unknown
          >;
          while (true) {
            const step = await toolIter.next();
            if (step.done) {
              toolCalls = step.value?.toolCalls ?? [];
              structuredEntities = step.value?.structured.entities ?? [];
              if (step.value?.structured.response?.trim()) {
                assistantText = step.value.structured.response;
              }
              break;
            }
            if (signal.aborted) break;
            assistantText += step.value;
            send({ type: "delta", text: step.value });
          }
        } else {
          const textIter = completion as AsyncGenerator<
            string,
            StructuredChatResponse,
            unknown
          >;
          while (true) {
            const step = await textIter.next();
            if (step.done) {
              structuredEntities = step.value?.entities ?? [];
              if (step.value?.response?.trim()) {
                assistantText = step.value.response;
              }
              break;
            }
            if (signal.aborted) break;
            assistantText += step.value;
            send({ type: "delta", text: step.value });
          }
        }

        if (signal.aborted) {
          const partial = parseStructuredChatResponse(assistantText).response.trim() || assistantText.trim();
          chatLogger.info("chat_stream_cancelled", {
            requestId,
            conversationId,
            partialChars: partial.length,
            elapsedMs: Date.now() - startedAt,
          });
          if (partial) {
            const { data: cancelledRow } = await supabase
              .from("conversation_messages")
              .insert({
                conversation_id: conversationId,
                role: "assistant",
                content: partial,
                metadata: { cancelled: true },
              })
              .select("id, conversation_id, role, content, metadata, created_at")
              .single();
            send({
              type: "cancelled",
              message: cancelledRow ? asMessageRow(cancelledRow) : undefined,
            });
          } else {
            send({ type: "cancelled" });
          }
          send({ type: "done" });
          return;
        }

        // Always unwrap {response, entities} so we never persist/show raw JSON in the bubble.
        // Also recover places from mistaken <entity> markup when the model skips the JSON array.
        const structured = parseStructuredChatResponse(assistantText);
        if (structured.response.trim()) {
          assistantText = structured.response;
        } else {
          assistantText = stripEntityMarkup(assistantText);
        }
        structuredEntities = mergeChatEntities(structuredEntities, structured.entities);

        const trimmedAssistant = assistantText.trim();
        if (!trimmedAssistant) {
          throw new Error("Empty AI response");
        }

        // Last-resort: if the model named places in prose but skipped the entities array,
        // recover candidates so Google Place cards can still render.
        if (!structuredEntities.length) {
          structuredEntities = extractPlacesHeuristic(trimmedAssistant, 6).map((p) => ({
            type: p.type || "place",
            name: p.name,
          }));
        }

        // Build inline destination cards during Discovery narrowing/shortlist (no itinerary).
        const recommendationCards =
          memory.discovery_active &&
          (memory.discovery_phase === "narrowing" || memory.discovery_phase === "shortlist")
            ? buildChatDestinationCards({
                memory,
                candidateNames: [
                  ...harvestCandidateDestinations(trimmedAssistant),
                  ...memory.candidate_destinations,
                ],
                limit: 4,
              })
            : [];

        // Capture propose_itinerary_edits proposals for confirmation UI (never auto-applied).
        let itineraryProposal: ItineraryEditProposal | null = null;
        for (const call of toolCalls) {
          if (call.name !== "propose_itinerary_edits") continue;
          const toolResult = call.result as {
            ok?: boolean;
            data?: ProposeItineraryEditsOutput;
          };
          if (
            toolResult?.ok &&
            toolResult.data?.status === "proposed" &&
            toolResult.data.proposal?.edits?.length
          ) {
            itineraryProposal = toolResult.data.proposal;
          }
        }

        const assistantMetadata: Record<string, unknown> = regenerate
          ? { regenerated: true }
          : {};
        if (recommendationCards.length > 0) {
          assistantMetadata.recommendations = recommendationCards;
        }
        if (itineraryProposal) {
          assistantMetadata.itineraryProposal = itineraryProposal;
        }
        if (structuredEntities.length > 0) {
          assistantMetadata.entities = structuredEntities;
        }

        // Enrich places BEFORE finalizing the assistant message so cards arrive in metadata
        // (and remain visible even if a later place_cards SSE event is missed).
        let placeCards: ChatPlaceCard[] = [];
        try {
          const enrichPromise = buildChatPlaceCardsFromEntities(structuredEntities, {
            locationBias:
              companionContext?.destination ||
              memory.preferred_destination ||
              memory.candidate_destinations?.[0] ||
              resolvedUserLocation?.city ||
              [resolvedUserLocation?.state, resolvedUserLocation?.country]
                .filter(Boolean)
                .join(", ") ||
              null,
            limit: 6,
            signal,
          });
          const timeoutPromise = new Promise<ChatPlaceCard[]>((resolve) => {
            const timer = setTimeout(() => resolve([]), 12_000);
            signal.addEventListener(
              "abort",
              () => {
                clearTimeout(timer);
                resolve([]);
              },
              { once: true },
            );
          });
          placeCards = await Promise.race([enrichPromise, timeoutPromise]);
        } catch (error) {
          chatLogger.warn("chat_place_enrichment_failed", {
            requestId,
            conversationId,
            error: error instanceof Error ? error.message : "unknown",
            entityCount: structuredEntities.length,
          });
          placeCards = [];
        }

        if (placeCards.length > 0) {
          assistantMetadata.placeCards = placeCards;
        }

        chatLogger.info("chat_place_enrichment", {
          requestId,
          conversationId,
          entityCount: structuredEntities.length,
          placeCardCount: placeCards.length,
          entities: structuredEntities.map((e) => e.name).slice(0, 8),
        });

        const { data: assistantRow, error: assistantError } = await supabase
          .from("conversation_messages")
          .insert({
            conversation_id: conversationId,
            role: "assistant",
            content: trimmedAssistant,
            metadata: assistantMetadata,
          })
          .select("id, conversation_id, role, content, metadata, created_at")
          .single();

        if (assistantError || !assistantRow) {
          throw new Error(assistantError?.message || "Failed to save assistant message");
        }

        send({ type: "assistant_message", message: asMessageRow(assistantRow) });

        if (recommendationCards.length > 0) {
          send({ type: "recommendations", cards: recommendationCards });
        }
        if (itineraryProposal) {
          send({ type: "itinerary_proposal", proposal: itineraryProposal });
        }
        if (placeCards.length > 0) {
          send({ type: "place_cards", cards: placeCards });
        }

        // After a narrowing reply, harvest destination shortlist into conversation memory.
        if (
          memory.discovery_active &&
          (memory.discovery_phase === "narrowing" ||
            memory.discovery_phase === "shortlist" ||
            recommendationCards.length > 0)
        ) {
          const harvested = [
            ...harvestCandidateDestinations(trimmedAssistant),
            ...recommendationCards.map((c) => c.name),
          ];
          if (harvested.length > 0) {
            const merged = mergeMemoryFields(memory, {
              candidate_destinations: harvested,
            });
            merged.discovery_phase = resolveDiscoveryPhase(merged);
            memory = await saveConversationMemory(supabase, conversationId, merged);
            send({ type: "memory", memory });
          }
        }

        // Sidebar label from conversation memory (place + theme) — no LLM title call.
        const label = buildConversationLabel(memory);
        const autoTitles = new Set([
          "new chat",
          "trip chat",
          "destination discovery",
          "trip planning",
          "untitled",
          "",
        ]);
        const titleIsAuto = autoTitles.has(conversationTitle.trim().toLowerCase());
        const nextTitle = titleIsAuto && conversationLabelIsReady(label) ? label.title : conversationTitle;
        const nextSubtitle = label.subtitle;
        const shouldUpdateLabel =
          (titleIsAuto && conversationLabelIsReady(label) && nextTitle !== conversationTitle) ||
          Boolean(nextSubtitle);

        if (shouldUpdateLabel && !signal.aborted) {
          const payload: { title: string; subtitle?: string } = {
            title: nextTitle,
            subtitle: nextSubtitle,
          };
          let { error: titleError } = await supabase
            .from("conversations")
            .update(payload)
            .eq("id", conversationId)
            .eq("user_id", user.id);
          if (titleError && /subtitle|schema cache|PGRST|column/i.test(titleError.message)) {
            const retry = await supabase
              .from("conversations")
              .update({ title: nextTitle })
              .eq("id", conversationId)
              .eq("user_id", user.id);
            titleError = retry.error;
          }
          if (!titleError) {
            conversationTitle = nextTitle;
            send({
              type: "title",
              conversationId,
              title: nextTitle,
              subtitle: nextSubtitle,
            });
          }
        }

        chatLogger.info("chat_stream_complete", {
          requestId,
          conversationId,
          assistantChars: trimmedAssistant.length,
          recommendationCount: recommendationCards.length,
          placeCardCount: placeCards.length,
          elapsedMs: Date.now() - startedAt,
        });
        send({ type: "done" });
      } catch (error) {
        if (isAbortError(error) || signal.aborted) {
          const partial = assistantText.trim();
          chatLogger.info("chat_stream_aborted", {
            requestId,
            conversationId,
            partialChars: partial.length,
            elapsedMs: Date.now() - startedAt,
          });
          if (partial) {
            const { data: cancelledRow } = await supabase
              .from("conversation_messages")
              .insert({
                conversation_id: conversationId,
                role: "assistant",
                content: partial,
                metadata: { cancelled: true },
              })
              .select("id, conversation_id, role, content, metadata, created_at")
              .single();
            send({
              type: "cancelled",
              message: cancelledRow ? asMessageRow(cancelledRow) : undefined,
            });
          } else {
            send({ type: "cancelled" });
          }
          send({ type: "done" });
          return;
        }
        const messageText =
          error instanceof Error ? error.message : "Chat failed";
        chatLogger.error("chat_stream_error", {
          requestId,
          conversationId,
          error,
          elapsedMs: Date.now() - startedAt,
        });
        // Send raw Gemini error; client formats with local renewal time.
        send({ type: "error", message: messageText });
        send({ type: "done" });
      } finally {
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    },
    cancel() {
      // Client disconnected — req.signal will abort Gemini fetch
      chatLogger.info("chat_client_disconnect", {
        requestId,
        conversationId,
        elapsedMs: Date.now() - startedAt,
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
