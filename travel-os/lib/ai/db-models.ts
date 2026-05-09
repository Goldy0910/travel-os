import type { AiIntentType, ItineraryActivityStatus } from "@/lib/ai/types";

export type ItineraryActivityStateRow = {
  id: string;
  activity_id: string;
  status: ItineraryActivityStatus;
  completed_at: string | null;
  skipped_reason: string | null;
  delay_minutes: number | null;
  user_feedback: string | null;
  created_at: string;
  updated_at: string;
};

export type ItineraryActivityStateInsert = {
  activity_id: string;
  status?: ItineraryActivityStatus;
  completed_at?: string | null;
  skipped_reason?: string | null;
  delay_minutes?: number | null;
  user_feedback?: string | null;
};

export type ItineraryActivityStateUpdate = Partial<
  Omit<ItineraryActivityStateRow, "id" | "activity_id" | "created_at" | "updated_at">
>;

export type ItineraryRevisionRow = {
  id: string;
  trip_id: string;
  day_id: string | null;
  revision_reason: string;
  previous_snapshot: Record<string, unknown>;
  updated_snapshot: Record<string, unknown>;
  created_at: string;
};

export type ItineraryRevisionInsert = {
  trip_id: string;
  day_id?: string | null;
  revision_reason: string;
  previous_snapshot: Record<string, unknown>;
  updated_snapshot: Record<string, unknown>;
};

export type AiConversationRow = {
  id: string;
  trip_id: string;
  user_id: string;
  intent: AiIntentType | string;
  message: string;
  response: Record<string, unknown>;
  created_at: string;
};

export type AiConversationInsert = {
  trip_id: string;
  user_id: string;
  intent: AiIntentType | string;
  message: string;
  response: Record<string, unknown>;
};

export type ItineraryItemAiMetadata = {
  priority_score: number | null;
  sunset_sensitive: boolean;
  booking_required: boolean;
  ai_generated: boolean;
  user_modified: boolean;
};
