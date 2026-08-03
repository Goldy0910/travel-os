import type { ChatRole, ChatStreamEvent, ConversationMessage } from "@/lib/chat/types";

const CHAT_ROLES: readonly ChatRole[] = ["user", "assistant", "system"];

export function asChatRole(value: unknown, fallback: ChatRole = "assistant"): ChatRole {
  if (typeof value === "string" && (CHAT_ROLES as readonly string[]).includes(value)) {
    return value as ChatRole;
  }
  return fallback;
}

export function asHistoryRole(value: unknown): "user" | "assistant" | null {
  if (value === "user" || value === "assistant") return value;
  return null;
}

export function asMessageMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function asMessageRow(row: {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  metadata: unknown;
  created_at: string;
}): ConversationMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    role: asChatRole(row.role),
    content: typeof row.content === "string" ? row.content : "",
    metadata: asMessageMetadata(row.metadata),
    created_at: row.created_at,
  };
}

const STREAM_EVENT_TYPES = new Set([
  "conversation",
  "user_message",
  "delta",
  "assistant_message",
  "recommendations",
  "place_cards",
  "itinerary_proposal",
  "title",
  "memory",
  "trip_memory",
  "cancelled",
  "error",
  "done",
]);

/** Runtime-narrow SSE payloads; returns null for malformed frames. */
export function parseChatStreamEvent(raw: unknown): ChatStreamEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const type = (raw as { type?: unknown }).type;
  if (typeof type !== "string" || !STREAM_EVENT_TYPES.has(type)) return null;
  return raw as ChatStreamEvent;
}
