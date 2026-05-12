import type {
  AiConversationInsert,
  ItineraryActivityStateInsert,
  ItineraryItemAiMetadata,
  ItineraryRevisionInsert,
} from "@/lib/ai/db-models";
import { AI_INTENT_TYPES, type ItineraryActivityStatus } from "@/lib/ai/types";

const ACTIVITY_STATUS_SET = new Set<ItineraryActivityStatus>([
  "pending",
  "completed",
  "skipped",
  "delayed",
  "replaced",
]);

const INTENT_SET = new Set<string>(AI_INTENT_TYPES);

export function isValidItineraryActivityStateInsert(
  value: ItineraryActivityStateInsert,
): value is ItineraryActivityStateInsert {
  if (!value.activity_id || typeof value.activity_id !== "string") return false;
  if (value.status && !ACTIVITY_STATUS_SET.has(value.status)) return false;
  if (value.delay_minutes != null && (!Number.isInteger(value.delay_minutes) || value.delay_minutes < 0)) {
    return false;
  }
  return true;
}

export function isValidItineraryRevisionInsert(
  value: ItineraryRevisionInsert,
): value is ItineraryRevisionInsert {
  if (!value.trip_id || typeof value.trip_id !== "string") return false;
  if (!value.revision_reason || typeof value.revision_reason !== "string") return false;
  if (typeof value.previous_snapshot !== "object" || value.previous_snapshot == null) return false;
  if (typeof value.updated_snapshot !== "object" || value.updated_snapshot == null) return false;
  return true;
}

export function isValidAiConversationInsert(value: AiConversationInsert): value is AiConversationInsert {
  if (!value.trip_id || typeof value.trip_id !== "string") return false;
  if (!value.user_id || typeof value.user_id !== "string") return false;
  if (!value.message || typeof value.message !== "string") return false;
  if (!value.intent || typeof value.intent !== "string") return false;
  if (!INTENT_SET.has(value.intent)) return false;
  if (typeof value.response !== "object" || value.response == null) return false;
  return true;
}

export function isValidItineraryItemAiMetadata(
  value: ItineraryItemAiMetadata,
): value is ItineraryItemAiMetadata {
  if (value.priority_score != null && (!Number.isInteger(value.priority_score) || value.priority_score < 0 || value.priority_score > 100)) {
    return false;
  }
  return (
    typeof value.sunset_sensitive === "boolean" &&
    typeof value.booking_required === "boolean" &&
    typeof value.ai_generated === "boolean" &&
    typeof value.user_modified === "boolean"
  );
}
