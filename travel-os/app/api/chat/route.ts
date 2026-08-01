import { generateChatTitle, streamChatCompletion } from "@/lib/chat/gemini-stream";
import { streamChatCompletionWithTools, type ChatToolCallRecord } from "@/lib/chat/gemini-tools";
import type { ItineraryEditProposal } from "@/lib/chat/itinerary-edit-types";
import type { ProposeItineraryEditsOutput } from "@/lib/tools/definitions/propose-itinerary-edits";
import {
  applyDiscoveryState,
  resolveDiscoveryPhase,
} from "@/lib/chat/discovery-agent";
import { buildChatDestinationCards } from "@/lib/chat/destination-cards";
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
};

function encodeSse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
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
  let isNewConversation = false;
  let titleSeedMessage = message;
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
    isNewConversation = ensured.created;
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
    isNewConversation = true;
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

  if (!titleSeedMessage) {
    const firstUser = [...history].reverse().find((h) => h.role === "user");
    titleSeedMessage = firstUser?.content ?? "New chat";
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
  });

  const systemPrompt = buildChatSystemPrompt(memory, {
    knowledgeContext,
    knowledgeMode: knowledgeMode && !memory.discovery_active && !companionContext,
    companionContext,
    tripMemory,
    userTravelMemory,
    retrievedContext,
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
        if (activeTripId) {
          const toolIter = completion as AsyncGenerator<
            string,
            ChatToolCallRecord[],
            unknown
          >;
          while (true) {
            const step = await toolIter.next();
            if (step.done) {
              toolCalls = step.value ?? [];
              break;
            }
            if (signal.aborted) break;
            assistantText += step.value;
            send({ type: "delta", text: step.value });
          }
        } else {
          for await (const delta of completion) {
            if (signal.aborted) break;
            assistantText += delta;
            send({ type: "delta", text: delta });
          }
        }

        if (signal.aborted) {
          const partial = assistantText.trim();
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

        const trimmedAssistant = assistantText.trim();
        if (!trimmedAssistant) {
          throw new Error("Empty AI response");
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

        if (isNewConversation || conversationTitle === "New chat") {
          try {
            const title = await generateChatTitle(titleSeedMessage, signal);
            const { error: titleError } = await supabase
              .from("conversations")
              .update({ title })
              .eq("id", conversationId)
              .eq("user_id", user.id);
            if (!titleError) {
              send({ type: "title", conversationId, title });
            }
          } catch (error) {
            if (isAbortError(error)) {
              send({ type: "cancelled", message: asMessageRow(assistantRow) });
              send({ type: "done" });
              return;
            }
            // Title generation is best-effort
          }
        }

        chatLogger.info("chat_stream_complete", {
          requestId,
          conversationId,
          assistantChars: trimmedAssistant.length,
          recommendationCount: recommendationCards.length,
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
