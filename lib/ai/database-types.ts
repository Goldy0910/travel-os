import type { AiIntentType, ItineraryActivityStatus } from "@/lib/ai/types";

export type AiDynamicTables = {
  itinerary_activity_state: {
    Row: {
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
    Insert: {
      id?: string;
      activity_id: string;
      status?: ItineraryActivityStatus;
      completed_at?: string | null;
      skipped_reason?: string | null;
      delay_minutes?: number | null;
      user_feedback?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      status?: ItineraryActivityStatus;
      completed_at?: string | null;
      skipped_reason?: string | null;
      delay_minutes?: number | null;
      user_feedback?: string | null;
      updated_at?: string;
    };
  };
  itinerary_revisions: {
    Row: {
      id: string;
      trip_id: string;
      day_id: string | null;
      revision_reason: string;
      previous_snapshot: Record<string, unknown>;
      updated_snapshot: Record<string, unknown>;
      created_at: string;
    };
    Insert: {
      id?: string;
      trip_id: string;
      day_id?: string | null;
      revision_reason: string;
      previous_snapshot: Record<string, unknown>;
      updated_snapshot: Record<string, unknown>;
      created_at?: string;
    };
    Update: {
      revision_reason?: string;
      previous_snapshot?: Record<string, unknown>;
      updated_snapshot?: Record<string, unknown>;
    };
  };
  ai_conversations: {
    Row: {
      id: string;
      trip_id: string;
      user_id: string;
      intent: AiIntentType | string;
      message: string;
      response: Record<string, unknown>;
      created_at: string;
    };
    Insert: {
      id?: string;
      trip_id: string;
      user_id: string;
      intent: AiIntentType | string;
      message: string;
      response?: Record<string, unknown>;
      created_at?: string;
    };
    Update: {
      intent?: AiIntentType | string;
      message?: string;
      response?: Record<string, unknown>;
    };
  };
};
