"use client";

import ChatExploreHeader from "@/app/app/chat/_components/chat-explore-header";
import AssistantMessageWithPlaces from "@/app/app/chat/_components/assistant-message-with-places";
import ChatMapPanel from "@/app/app/chat/_components/chat-map-panel";
import ChatSidebar from "@/app/app/chat/_components/chat-sidebar";
import ConversationMemoryPanel from "@/app/app/chat/_components/conversation-memory-panel";
import ConversationToolbar from "@/app/app/chat/_components/conversation-toolbar";
import CreateTripFromChatButton from "@/app/app/chat/_components/create-trip-from-chat-button";
import DestinationRecommendationCards, {
  cardsFromMessageMetadata,
} from "@/app/app/chat/_components/destination-recommendation-cards";
import ItineraryEditProposalCard, {
  proposalFromMessageMetadata,
} from "@/app/app/chat/_components/itinerary-edit-proposal-card";
import MessageActions from "@/app/app/chat/_components/message-actions";
import PlaceDetailsDrawer from "@/app/app/chat/_components/place-details-drawer";
import SuggestedActions from "@/app/app/chat/_components/suggested-actions";
import { useUserLocationOptional } from "@/app/app/_components/user-location-provider";
import type { ChatDestinationCard } from "@/lib/chat/destination-card-types";
import type { ItineraryEditProposal } from "@/lib/chat/itinerary-edit-types";
import { formatChatGeminiError } from "@/lib/chat/gemini-errors";
import { parseChatStreamEvent } from "@/lib/chat/guards";
import type { ConversationMemory } from "@/lib/chat/memory-types";
import type { ChatStreamEvent, Conversation, ConversationMessage } from "@/lib/chat/types";
import { unwrapAssistantContentForDisplay } from "@/lib/chat/structured-response";
import { LocationService } from "@/lib/location";
import { placeCardsFromMessageMetadata } from "@/lib/places/chat-place-cards";
import type { ChatPlaceCard } from "@/lib/places/types";
import { clientAllowRequest } from "@/lib/rate-limit";
import { PanelLeft, RotateCcw, SendHorizontal, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type UiMessage = ConversationMessage & {
  status?: "sending" | "streaming" | "failed" | "complete" | "cancelled";
  clientKey?: string;
};

/**
 * The left/bottom nav "Chat" link always points at the plain chat landing URL, so
 * clicking it while already there is a same-URL no-op for Next's router (no remount,
 * no fresh initial state). Dispatching this event lets the nav force the conversation
 * picker open even when no navigation actually occurs.
 */
const OPEN_CHAT_PICKER_EVENT = "travel-os-open-chat-picker";

type AIChatProps = {
  initialConversations: Conversation[];
  initialConversationId?: string | null;
  initialMessages?: ConversationMessage[];
  initialMemory?: ConversationMemory | null;
  /** When set, chat is bound to the trip's single conversation (no sidebar / new chat). */
  tripId?: string | null;
  tripScoped?: boolean;
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

function LoadingDots({ label = "Generating" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2" aria-live="polite" aria-label={label}>
      <div className="flex items-center gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.28s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.14s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500" />
      </div>
      <span className="text-xs text-slate-500">{label}…</span>
    </div>
  );
}

function StreamingCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-[1.05em] w-0.5 translate-y-[0.15em] animate-pulse bg-sky-500 align-baseline"
      aria-hidden
    />
  );
}

async function readChatStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
) {
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener("abort", onAbort);

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.startsWith("data:"));
        if (!line) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          const event = parseChatStreamEvent(JSON.parse(raw) as unknown);
          if (event) onEvent(event);
        } catch {
          // ignore malformed frames
        }
      }
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

function stripTrailingAssistants(messages: UiMessage[]): UiMessage[] {
  let end = messages.length;
  while (end > 0 && messages[end - 1]?.role === "assistant") end -= 1;
  return messages.slice(0, end);
}

export default function AIChat({
  initialConversations,
  initialConversationId = null,
  initialMessages = [],
  initialMemory = null,
  tripId = null,
  tripScoped = false,
}: AIChatProps) {
  const userLocation = useUserLocationOptional();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [messages, setMessages] = useState<UiMessage[]>(
    initialMessages.map((m) => ({
      ...m,
      content:
        m.role === "assistant" ? unwrapAssistantContentForDisplay(m.content) : m.content,
      status: m.metadata?.cancelled ? "cancelled" : "complete",
    })),
  );
  const [memory, setMemory] = useState<ConversationMemory | null>(initialMemory);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState("");
  const [failedRetryContent, setFailedRetryContent] = useState<string | null>(null);
  const [retryMode, setRetryMode] = useState<"resend" | "regenerate">("resend");
  // Standalone Chat opens with the conversation list shown as an overlay above
  // the page. Choosing (or starting) a conversation closes the overlay and
  // reveals/updates the chat page underneath.
  const [conversationPickerOpen, setConversationPickerOpen] = useState(
    !tripScoped && initialConversationId == null,
  );
  const [createTripOpenSignal, setCreateTripOpenSignal] = useState(0);
  /** Assistant clientKey waiting for post-stream place card enrichment. */
  const [pendingPlaceCardsKey, setPendingPlaceCardsKey] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<ChatPlaceCard | null>(null);
  const [placeDrawerOpen, setPlaceDrawerOpen] = useState(false);
  const [focusedMapPlaceId, setFocusedMapPlaceId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  /** Sync guard — React state alone can miss rapid double-submit. */
  const sendingRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const deltaBufferRef = useRef("");
  const deltaFlushRafRef = useRef<number | null>(null);
  const optimisticAssistantKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  // First time opening chat: ask for location once if still unknown (choice remembered).
  const locationPromptedRef = useRef(false);
  useEffect(() => {
    if (!userLocation || locationPromptedRef.current) return;
    locationPromptedRef.current = true;
    userLocation.promptForPermissionIfNeeded();
  }, [userLocation]);

  // Nav "Chat" clicks while already on this page can't rely on navigation/remount —
  // force the conversation picker open so the list is always shown, from anywhere.
  useEffect(() => {
    if (tripScoped) return;
    const onOpenPicker = () => setConversationPickerOpen(true);
    window.addEventListener(OPEN_CHAT_PICKER_EVENT, onOpenPicker);
    return () => window.removeEventListener(OPEN_CHAT_PICKER_EVENT, onOpenPicker);
  }, [tripScoped]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      loadAbortRef.current?.abort();
      if (deltaFlushRafRef.current != null) {
        cancelAnimationFrame(deltaFlushRafRef.current);
      }
    };
  }, []);

  const onScrollMessages = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  const flushDeltaBuffer = () => {
    deltaFlushRafRef.current = null;
    const chunk = deltaBufferRef.current;
    if (!chunk) return;
    deltaBufferRef.current = "";
    const key = optimisticAssistantKeyRef.current;
    if (!key) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.clientKey === key
          ? { ...m, content: m.content + chunk, status: "streaming" }
          : m,
      ),
    );
  };

  const queueDelta = (text: string) => {
    deltaBufferRef.current += text;
    if (deltaFlushRafRef.current != null) return;
    deltaFlushRafRef.current = requestAnimationFrame(flushDeltaBuffer);
  };

  const clearDeltaBuffer = () => {
    if (deltaFlushRafRef.current != null) {
      cancelAnimationFrame(deltaFlushRafRef.current);
      deltaFlushRafRef.current = null;
    }
    deltaBufferRef.current = "";
  };

  const activeTitle =
    conversations.find((c) => c.id === activeConversationId)?.title ?? "New chat";

  // Shown beside "Trip chat" instead of a static subtitle + the full memory panel,
  // so known trip details don't cost extra vertical space.
  const tripChatSummary = tripScoped
    ? [memory?.travel_duration?.trim(), memory?.interests?.length ? memory.interests.join(", ") : ""]
        .filter((v): v is string => Boolean(v))
        .join(" · ")
    : "";

  const mapPlaces = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m?.role !== "assistant") continue;
      const cards = placeCardsFromMessageMetadata(m.metadata);
      if (cards.length) return cards;
    }
    return [] as ChatPlaceCard[];
  }, [messages]);

  const openPlaceDetails = (card: ChatPlaceCard) => {
    setSelectedPlace(card);
    setFocusedMapPlaceId(card.placeId);
    setPlaceDrawerOpen(true);
  };

  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") return i;
    }
    return -1;
  })();

  const loadConversation = async (conversationId: string) => {
    if (sendingRef.current) abortRef.current?.abort();
    loadAbortRef.current?.abort();
    const loadController = new AbortController();
    loadAbortRef.current = loadController;
    const requestId = ++loadRequestIdRef.current;

    setLoadingConversation(true);
    setError("");
    setFailedRetryContent(null);
    stickToBottomRef.current = true;
    try {
      const res = await fetch(
        `/api/chat?conversationId=${encodeURIComponent(conversationId)}`,
        { signal: loadController.signal },
      );
      if (requestId !== loadRequestIdRef.current) return;
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        messages?: ConversationMessage[];
        conversation?: Conversation;
        memory?: ConversationMemory;
      };
      if (requestId !== loadRequestIdRef.current) return;
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load conversation");
      setActiveConversationId(conversationId);
      setPlaceDrawerOpen(false);
      setSelectedPlace(null);
      setFocusedMapPlaceId(null);
      setMessages(
        (data.messages ?? []).map((m) => ({
          ...m,
          content:
            m.role === "assistant" ? unwrapAssistantContentForDisplay(m.content) : m.content,
          status: m.metadata?.cancelled ? "cancelled" : "complete",
        })),
      );
      setMemory(data.memory ?? null);
      if (data.conversation) {
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === data.conversation!.id);
          if (exists) {
            return prev.map((c) => (c.id === data.conversation!.id ? data.conversation! : c));
          }
          return [data.conversation!, ...prev];
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (requestId !== loadRequestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoadingConversation(false);
      }
    }
  };

  const startNewChat = () => {
    if (tripScoped) return;
    abortRef.current?.abort();
    loadAbortRef.current?.abort();
    loadRequestIdRef.current += 1;
    setActiveConversationId(null);
    setMessages([]);
    setMemory(null);
    setDraft("");
    setError("");
    setFailedRetryContent(null);
    setRetryMode("resend");
    setLoadingConversation(false);
    setPlaceDrawerOpen(false);
    setSelectedPlace(null);
    setFocusedMapPlaceId(null);
    stickToBottomRef.current = true;
  };

  const cancelGeneration = () => {
    abortRef.current?.abort();
  };

  const sendMessage = async (
    content: string,
    options?: { regenerate?: boolean },
  ) => {
    const regenerate = options?.regenerate === true;
    const trimmed = content.trim();
    if ((!trimmed && !regenerate) || sendingRef.current) return;
    if (regenerate && !activeConversationId && !tripId) return;
    if (!clientAllowRequest(`chat-send:${tripId || activeConversationId || "new"}`, 350)) {
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setError("");
    setFailedRetryContent(null);
    stickToBottomRef.current = true;
    clearDeltaBuffer();
    if (!regenerate) setDraft("");

    const optimisticKey = `local-${Date.now()}`;
    const assistantClientKey = `${optimisticKey}-assistant`;
    optimisticAssistantKeyRef.current = assistantClientKey;
    const streamingAssistant: UiMessage = {
      id: assistantClientKey,
      clientKey: assistantClientKey,
      conversation_id: activeConversationId ?? "",
      role: "assistant",
      content: "",
      metadata: {},
      created_at: new Date().toISOString(),
      status: "streaming",
    };

    if (regenerate) {
      setMessages((prev) => [...stripTrailingAssistants(prev), streamingAssistant]);
    } else {
      const optimisticUser: UiMessage = {
        id: optimisticKey,
        clientKey: optimisticKey,
        conversation_id: activeConversationId ?? "",
        role: "user",
        content: trimmed,
        metadata: {},
        created_at: new Date().toISOString(),
        status: "sending",
      };
      setMessages((prev) => [...prev, optimisticUser, streamingAssistant]);
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let userMessageConfirmed = regenerate;
    let cancelledByUser = false;
    let sawAssistantFinal = false;
    let sawDone = false;
    let sawDelta = false;

    const markIncompleteStream = (reason: string) => {
      clearDeltaBuffer();
      setError(reason);
      setFailedRetryContent(trimmed || "retry");
      setRetryMode(userMessageConfirmed ? "regenerate" : "resend");
      setMessages((prev) =>
        prev
          .map((m): UiMessage => {
            if (m.clientKey !== assistantClientKey) {
              if (m.clientKey === optimisticKey) {
                return {
                  ...m,
                  status: userMessageConfirmed ? "complete" : "failed",
                };
              }
              return m;
            }
            if (!m.content.trim()) return { ...m, status: "failed" };
            return {
              ...m,
              status: "cancelled",
              metadata: { ...m.metadata, cancelled: true, incomplete: true },
            };
          })
          .filter(
            (m) => !(m.clientKey === assistantClientKey && !m.content.trim()),
          ),
      );
    };

    try {
      // Read from LocationService at send-time (localStorage) so we never miss
      // a just-granted location due to stale React state.
      const promptLocation =
        LocationService.getPromptContext() ?? userLocation?.promptContext ?? null;
      const locationPayload = promptLocation ? { userLocation: promptLocation } : {};

      const payload = regenerate
        ? {
            conversationId: activeConversationId || undefined,
            regenerate: true,
            ...(tripId ? { tripId } : {}),
            ...locationPayload,
          }
        : {
            message: trimmed,
            conversationId: activeConversationId || undefined,
            ...(tripId ? { tripId } : {}),
            ...locationPayload,
          };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        if (res.status === 429) {
          throw new Error(data?.error || "Too many requests. Please wait a moment.");
        }
        throw new Error(data?.error || `Chat failed (${res.status})`);
      }

      let streamError = "";

      await readChatStream(
        res,
        (event) => {
          if (event.type === "conversation") {
            setActiveConversationId(event.conversation.id);
            setConversations((prev) => {
              const exists = prev.some((c) => c.id === event.conversation.id);
              if (exists) {
                return prev.map((c) =>
                  c.id === event.conversation.id
                    ? {
                        ...c,
                        title: event.conversation.title,
                        updated_at: new Date().toISOString(),
                      }
                    : c,
                );
              }
              return [
                {
                  id: event.conversation.id,
                  user_id: "",
                  title: event.conversation.title,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                ...prev,
              ];
            });
            setMessages((prev) =>
              prev.map((m) =>
                m.clientKey === optimisticKey || m.clientKey === assistantClientKey
                  ? { ...m, conversation_id: event.conversation.id }
                  : m,
              ),
            );
          }

          if (event.type === "user_message") {
            userMessageConfirmed = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.clientKey === optimisticKey
                  ? { ...event.message, status: "complete" as const }
                  : m,
              ),
            );
          }

          if (event.type === "delta") {
            sawDelta = true;
            queueDelta(event.text);
          }

          if (event.type === "assistant_message") {
            sawAssistantFinal = true;
            clearDeltaBuffer();
            setPendingPlaceCardsKey(assistantClientKey);
            const cleanContent = unwrapAssistantContentForDisplay(event.message.content);
            const existingPlaceCards = placeCardsFromMessageMetadata(event.message.metadata);
            if (existingPlaceCards.length > 0) {
              setPendingPlaceCardsKey(null);
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.clientKey === assistantClientKey
                  ? {
                      ...event.message,
                      // Keep optimistic key so later place_cards / recommendations still match.
                      clientKey: assistantClientKey,
                      content: cleanContent,
                      status: "complete" as const,
                    }
                  : m,
              ),
            );
          }

          if (event.type === "recommendations") {
            const cards: ChatDestinationCard[] = event.cards;
            setMessages((prev) =>
              prev.map((m) =>
                m.clientKey === assistantClientKey
                  ? {
                      ...m,
                      metadata: { ...m.metadata, recommendations: cards },
                    }
                  : m,
              ),
            );
          }

          if (event.type === "place_cards") {
            const cards: ChatPlaceCard[] = event.cards;
            setPendingPlaceCardsKey((key) =>
              key === assistantClientKey ? null : key,
            );
            setMessages((prev) =>
              prev.map((m) =>
                m.clientKey === assistantClientKey
                  ? {
                      ...m,
                      metadata: { ...m.metadata, placeCards: cards },
                    }
                  : m,
              ),
            );
          }

          if (event.type === "itinerary_proposal") {
            const proposal: ItineraryEditProposal = event.proposal;
            setMessages((prev) =>
              prev.map((m) =>
                m.clientKey === assistantClientKey
                  ? {
                      ...m,
                      metadata: { ...m.metadata, itineraryProposal: proposal },
                    }
                  : m,
              ),
            );
          }

          if (event.type === "cancelled") {
            cancelledByUser = true;
            clearDeltaBuffer();
            setPendingPlaceCardsKey((key) =>
              key === assistantClientKey ? null : key,
            );
            setMessages((prev) =>
              prev
                .map((m): UiMessage => {
                  if (m.clientKey !== assistantClientKey) return m;
                  if (event.message) {
                    return { ...event.message, status: "cancelled" };
                  }
                  if (!m.content.trim()) return { ...m, status: "cancelled" };
                  return {
                    ...m,
                    status: "cancelled",
                    metadata: { ...m.metadata, cancelled: true },
                  };
                })
                .filter(
                  (m) =>
                    !(m.clientKey === assistantClientKey && !m.content.trim()),
                ),
            );
          }

          if (event.type === "title") {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === event.conversationId
                  ? {
                      ...c,
                      title: event.title,
                      subtitle:
                        typeof event.subtitle === "string" ? event.subtitle : c.subtitle,
                      updated_at: new Date().toISOString(),
                    }
                  : c,
              ),
            );
          }

          if (event.type === "memory") {
            setMemory(event.memory);
          }

          if (event.type === "error") {
            streamError = event.message;
          }

          if (event.type === "done") {
            sawDone = true;
            setPendingPlaceCardsKey((key) =>
              key === assistantClientKey ? null : key,
            );
          }
        },
        controller.signal,
      );

      if (cancelledByUser) return;
      if (streamError) throw new Error(streamError);

      // Stream ended without a final assistant message (disconnect / proxy cut).
      if (!sawAssistantFinal) {
        if (sawDelta || deltaBufferRef.current) {
          if (deltaBufferRef.current) flushDeltaBuffer();
          markIncompleteStream(
            "Connection interrupted. Partial reply kept — tap Retry to continue.",
          );
          return;
        }
        throw new Error(sawDone ? "No response received" : "Connection lost before a reply arrived");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        clearDeltaBuffer();
        setMessages((prev) =>
          prev
            .map((m) =>
              m.clientKey === assistantClientKey
                ? m.content.trim()
                  ? {
                      ...m,
                      status: "cancelled" as const,
                      metadata: { ...m.metadata, cancelled: true },
                    }
                  : m
                : m.clientKey === optimisticKey
                  ? { ...m, status: "complete" as const }
                  : m,
            )
            .filter(
              (m) =>
                !(m.clientKey === assistantClientKey && !m.content.trim()),
            ),
        );
        return;
      }
      const messageText = formatChatGeminiError(err);
      setError(messageText);
      setFailedRetryContent(trimmed || "retry");
      setRetryMode(userMessageConfirmed ? "regenerate" : "resend");
      clearDeltaBuffer();
      setMessages((prev) =>
        prev
          .filter((m) => {
            if (m.clientKey !== assistantClientKey) return true;
            return Boolean(m.content.trim());
          })
          .map((m) => {
            if (m.clientKey === assistantClientKey) {
              return {
                ...m,
                status: "cancelled" as const,
                metadata: { ...m.metadata, cancelled: true, incomplete: true },
              };
            }
            if (m.clientKey === optimisticKey) {
              return {
                ...m,
                status: (userMessageConfirmed ? "complete" : "failed") as UiMessage["status"],
              };
            }
            return m;
          }),
      );
    } finally {
      clearDeltaBuffer();
      optimisticAssistantKeyRef.current = null;
      sendingRef.current = false;
      setSending(false);
      abortRef.current = null;
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(draft);
  };

  const onRetry = () => {
    if (!failedRetryContent || sendingRef.current) return;
    if (retryMode === "regenerate") {
      void sendMessage(failedRetryContent, { regenerate: true });
      return;
    }
    setMessages((prev) => prev.filter((m) => m.status !== "failed"));
    void sendMessage(failedRetryContent);
  };

  const onRegenerate = () => {
    if (sendingRef.current || (!activeConversationId && !tripId) || lastAssistantIndex < 0) {
      return;
    }
    void sendMessage("regenerate", { regenerate: true });
  };

  // Trip chat and the standalone page share the same shell: ChatSidebar is an overlay
  // (fixed position, no layout footprint) in both cases, so the only real difference is
  // the header content and hiding "new chat" affordances that don't apply to a single
  // trip-scoped conversation.
  const shellClass = "flex h-full min-h-0 gap-3 px-3 py-3 md:gap-4 md:px-6 md:py-4";

  return (
    <div className={shellClass}>
      {tripScoped ? null : (
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={(id) => {
            setConversationPickerOpen(false);
            void loadConversation(id);
          }}
          onNewChat={() => {
            setConversationPickerOpen(false);
            startNewChat();
          }}
          onConversationsChange={setConversations}
          onDeletedActive={startNewChat}
          open={conversationPickerOpen}
          onOpenChange={setConversationPickerOpen}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <section
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        aria-label={tripScoped ? "Trip chat" : "AI travel chat"}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 md:px-4">
          {tripScoped ? null : (
            <button
              type="button"
              onClick={() => setConversationPickerOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
              aria-label="Show conversations"
            >
              <PanelLeft className="h-4 w-4" aria-hidden />
            </button>
          )}
          {tripScoped ? (
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                <h2 className="shrink-0 text-sm font-semibold text-slate-900">Trip chat</h2>
                {tripChatSummary ? (
                  <p className="min-w-0 truncate text-xs text-slate-500">{tripChatSummary}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <ChatExploreHeader
              title={activeTitle}
              memory={memory}
              onCreateTrip={() => setCreateTripOpenSignal((n) => n + 1)}
              createTripDisabled={sending || !activeConversationId}
            />
          )}
          <ConversationToolbar
            title={tripScoped ? "Trip chat" : activeTitle}
            conversationId={activeConversationId}
            messages={messages.map((m) => ({
              role: m.role,
              content: m.content,
              created_at: m.created_at,
            }))}
            disabled={sending || loadingConversation}
          />
        </div>

        {tripScoped ? null : (
          <CreateTripFromChatButton
            conversationId={activeConversationId}
            memory={memory}
            disabled={sending}
            openSignal={createTripOpenSignal}
          />
        )}

        {tripScoped ? null : <ConversationMemoryPanel memory={memory} />}

        <div
          ref={scrollRef}
          onScroll={onScrollMessages}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-busy={sending || loadingConversation}
          aria-label="Chat messages"
        >
          {loadingConversation ? (
            <div className="flex min-h-32 items-center justify-center">
              <LoadingDots label="Loading conversation" />
            </div>
          ) : null}

          {!loadingConversation && messages.length === 0 && !error ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center px-2 text-center">
              <p className="text-base font-medium text-slate-900">Where do you want to go?</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Plan destinations, dates, and budget here. When details are clear, you can create a
                trip from this chat.
              </p>
            </div>
          ) : null}

          {!loadingConversation && messages.length === 0 && error ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 px-2 text-center">
              <p className="text-sm text-rose-700" role="alert">
                {error}
              </p>
              {activeConversationId ? (
                <button
                  type="button"
                  onClick={() => void loadConversation(activeConversationId)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Reload conversation
                </button>
              ) : null}
            </div>
          ) : null}

          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isStreamingEmpty = message.status === "streaming" && !message.content;
            const isStreamingTokens = message.status === "streaming" && !!message.content;
            const recommendationCards = !isUser
              ? cardsFromMessageMetadata(message.metadata)
              : [];
            const placeCards = !isUser
              ? placeCardsFromMessageMetadata(message.metadata)
              : [];
            const showPlaceSkeleton =
              !isUser &&
              pendingPlaceCardsKey != null &&
              (message.clientKey ?? message.id) === pendingPlaceCardsKey &&
              placeCards.length === 0;
            const itineraryProposal = !isUser
              ? proposalFromMessageMetadata(message.metadata)
              : null;
            const canRegenerate =
              !sending &&
              !isUser &&
              index === lastAssistantIndex &&
              (message.status === "complete" || message.status === "cancelled");
            const showSuggestedActions =
              !isUser &&
              index === lastAssistantIndex &&
              !isStreamingEmpty &&
              !isStreamingTokens &&
              (message.status === "complete" || message.status === "cancelled") &&
              Boolean(message.content.trim());

            return (
              <div
                key={message.clientKey ?? message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex min-w-0 flex-col ${isUser ? "items-end" : "items-start gap-2"}`}>
                  <div
                    className={`w-full max-w-[min(100%,42rem)] ${
                      isUser ? "" : "space-y-2.5"
                    }`}
                  >
                  {isUser ? (
                    <div
                      className={`rounded-2xl bg-slate-900 px-3.5 py-2.5 text-white ${
                        message.status === "failed" ? "ring-1 ring-rose-300" : ""
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                    </div>
                  ) : isStreamingEmpty ? (
                    <div className="rounded-2xl bg-slate-50 px-3.5 py-2.5 text-slate-800 ring-1 ring-slate-200">
                      <LoadingDots />
                    </div>
                  ) : (
                    <div
                      className={
                        placeCards.length > 0 || showPlaceSkeleton
                          ? "min-w-0"
                          : `rounded-2xl bg-slate-50 px-3.5 py-2.5 text-slate-800 ring-1 ring-slate-200 ${
                              message.status === "failed" ? "ring-rose-300" : ""
                            }`
                      }
                    >
                      <AssistantMessageWithPlaces
                        content={unwrapAssistantContentForDisplay(message.content)}
                        cards={placeCards}
                        loadingPlaces={showPlaceSkeleton}
                        streaming={isStreamingTokens}
                        streamingCursor={<StreamingCursor />}
                        onOpenPlace={openPlaceDetails}
                        onFocusPlaceOnMap={(c) => setFocusedMapPlaceId(c.placeId)}
                        onHoverPlace={(c) => setFocusedMapPlaceId(c.placeId)}
                        onHoverPlaceEnd={() => {
                          // Keep pin highlighted while drawer is open for that place
                          if (!placeDrawerOpen) setFocusedMapPlaceId(null);
                        }}
                        extras={
                          !isStreamingTokens ? (
                            <>
                              <DestinationRecommendationCards cards={recommendationCards} />
                              {itineraryProposal ? (
                                <ItineraryEditProposalCard
                                  proposal={itineraryProposal}
                                  onStatusChange={(proposalId, status) => {
                                    setMessages((prev) =>
                                      prev.map((m) => {
                                        if (
                                          (m.clientKey ?? m.id) !==
                                          (message.clientKey ?? message.id)
                                        ) {
                                          return m;
                                        }
                                        const current = proposalFromMessageMetadata(m.metadata);
                                        if (!current || current.proposalId !== proposalId) {
                                          return m;
                                        }
                                        return {
                                          ...m,
                                          metadata: {
                                            ...m.metadata,
                                            itineraryProposal: { ...current, status },
                                          },
                                        };
                                      }),
                                    );
                                  }}
                                />
                              ) : null}
                            </>
                          ) : null
                        }
                      />
                    </div>
                  )}

                  <div
                    className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] ${
                      isUser ? "justify-end text-slate-300" : "text-slate-400"
                    }`}
                  >
                    <time dateTime={message.created_at}>{formatTimestamp(message.created_at)}</time>
                    {message.status === "failed" ? <span>Failed to send</span> : null}
                    {message.status === "cancelled" ? (
                      <span>{message.metadata?.incomplete ? "Incomplete" : "Stopped"}</span>
                    ) : null}
                    {message.status === "streaming" ? (
                      <span aria-live="polite">Streaming</span>
                    ) : null}
                    {message.status === "complete" || message.status === "cancelled" ? (
                      <MessageActions
                        conversationId={
                          message.conversation_id || activeConversationId
                        }
                        messageId={message.id}
                        content={message.content}
                        isUser={isUser}
                        disabled={sending}
                      />
                    ) : null}
                    {canRegenerate ? (
                      <button
                        type="button"
                        onClick={onRegenerate}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium text-sky-700 transition hover:bg-sky-50"
                        aria-label="Regenerate assistant reply"
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden />
                        Regenerate
                      </button>
                    ) : null}
                  </div>
                  </div>
                  {showSuggestedActions ? (
                    <SuggestedActions
                      tripScoped={tripScoped}
                      tripId={tripId}
                      conversationId={activeConversationId}
                      memory={memory}
                      disabled={sending}
                      onRequestCreateTrip={() => setCreateTripOpenSignal((n) => n + 1)}
                      onSendPrompt={(prompt) => void sendMessage(prompt)}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {(error || failedRetryContent) && !sending && messages.length > 0 ? (
          <div
            className="flex flex-col gap-2 border-t border-rose-100 bg-rose-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4"
            role="alert"
            aria-live="assertive"
          >
            <p className="text-xs text-rose-700">{error || "Message failed"}</p>
            {failedRetryContent ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={sending}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:opacity-50 sm:self-auto"
                aria-label={retryMode === "regenerate" ? "Retry regenerate reply" : "Retry send message"}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          aria-label="Send a message"
        >
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor="ai-chat-input">
              Message
            </label>
            <textarea
              id="ai-chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!sendingRef.current) void sendMessage(draft);
                }
              }}
              rows={1}
              placeholder="Ask anything."
              disabled={sending}
              aria-disabled={sending}
              className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-200 placeholder:text-slate-400 focus:ring-2 disabled:opacity-60"
            />
            {sending ? (
              <button
                type="button"
                onClick={cancelGeneration}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white transition hover:bg-rose-500"
                aria-label="Stop generating"
                title="Stop"
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <SendHorizontal className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </form>
      </section>

      <ChatMapPanel
        places={mapPlaces}
        focusedPlaceId={focusedMapPlaceId}
        onSelectPlace={openPlaceDetails}
        className="hidden w-2/5 shrink-0 lg:flex"
      />
      </div>

      <PlaceDetailsDrawer
        card={selectedPlace}
        open={placeDrawerOpen}
        onClose={() => setPlaceDrawerOpen(false)}
      />
    </div>
  );
}
