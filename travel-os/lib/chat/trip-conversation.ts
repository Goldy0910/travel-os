import type { SupabaseClient } from "@supabase/supabase-js";
import { isTripMember } from "@/lib/trip-membership";

export type TripConversationRow = {
  id: string;
  user_id: string;
  title: string;
  trip_id: string | null;
  created_at: string;
  updated_at: string;
};

type EnsureResult =
  | { ok: true; conversation: TripConversationRow; created: boolean }
  | { ok: false; error: string; status: number };

function asConversation(row: Record<string, unknown>): TripConversationRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id ?? ""),
    title: typeof row.title === "string" && row.title.trim() ? row.title : "Trip chat",
    trip_id: row.trip_id == null ? null : String(row.trip_id),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

/**
 * Resolve or create the single AI conversation owned by a trip.
 * Preserves existing conversation rows and message history.
 */
export async function ensureTripConversation(
  supabase: SupabaseClient,
  opts: {
    tripId: string;
    userId: string;
    /** Prefer this conversation when attaching (e.g. create-trip-from-chat). */
    attachConversationId?: string | null;
    title?: string;
  },
): Promise<EnsureResult> {
  const tripId = opts.tripId.trim();
  if (!tripId) return { ok: false, error: "tripId is required", status: 400 };

  const member = await isTripMember(supabase, tripId, opts.userId);
  if (!member) return { ok: false, error: "Not a trip member", status: 403 };

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, title, location, conversation_id, user_id")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError) {
    return { ok: false, error: tripError.message, status: 500 };
  }
  if (!trip) {
    return { ok: false, error: "Trip not found", status: 404 };
  }

  const tripTitle =
    (typeof opts.title === "string" && opts.title.trim()) ||
    (typeof trip.title === "string" && trip.title.trim()) ||
    (typeof trip.location === "string" && trip.location.trim()) ||
    "Trip chat";

  const linkedId =
    typeof trip.conversation_id === "string" && trip.conversation_id.trim()
      ? trip.conversation_id.trim()
      : "";

  // 1) Prefer trip.conversation_id if the row still exists
  if (linkedId) {
    const { data: linked, error } = await supabase
      .from("conversations")
      .select("id, user_id, title, trip_id, created_at, updated_at")
      .eq("id", linkedId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message, status: 500 };
    if (linked) {
      if (linked.trip_id !== tripId) {
        const { error: attachError } = await supabase
          .from("conversations")
          .update({ trip_id: tripId })
          .eq("id", linked.id);
        if (attachError && !/trip_id|schema cache|PGRST/i.test(attachError.message)) {
          return { ok: false, error: attachError.message, status: 500 };
        }
      }
      return {
        ok: true,
        conversation: asConversation({ ...linked, trip_id: tripId }),
        created: false,
      };
    }
  }

  // 2) Prefer conversation already owned by this trip
  {
    const { data: byTrip, error } = await supabase
      .from("conversations")
      .select("id, user_id, title, trip_id, created_at, updated_at")
      .eq("trip_id", tripId)
      .maybeSingle();

    if (error && !/trip_id|schema cache|PGRST|column/i.test(error.message)) {
      return { ok: false, error: error.message, status: 500 };
    }

    if (byTrip) {
      if (trip.conversation_id !== byTrip.id) {
        await supabase.from("trips").update({ conversation_id: byTrip.id }).eq("id", tripId);
      }
      return { ok: true, conversation: asConversation(byTrip), created: false };
    }
  }

  // 3) Attach an existing standalone conversation (preserves history)
  const attachId =
    typeof opts.attachConversationId === "string" ? opts.attachConversationId.trim() : "";
  if (attachId) {
    const { data: attach, error } = await supabase
      .from("conversations")
      .select("id, user_id, title, trip_id, created_at, updated_at")
      .eq("id", attachId)
      .eq("user_id", opts.userId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message, status: 500 };
    if (!attach) return { ok: false, error: "Conversation not found", status: 404 };

    if (attach.trip_id && attach.trip_id !== tripId) {
      return {
        ok: false,
        error: "Conversation already belongs to another trip",
        status: 409,
      };
    }

    const { error: attachError } = await supabase
      .from("conversations")
      .update({ trip_id: tripId })
      .eq("id", attach.id);

    if (attachError && !/trip_id|schema cache|PGRST/i.test(attachError.message)) {
      return { ok: false, error: attachError.message, status: 500 };
    }

    await supabase.from("trips").update({ conversation_id: attach.id }).eq("id", tripId);

    return {
      ok: true,
      conversation: asConversation({ ...attach, trip_id: tripId }),
      created: false,
    };
  }

  // 4) Create a fresh conversation for this trip (owned by trip creator when known)
  const ownerId =
    typeof trip.user_id === "string" && trip.user_id.trim()
      ? trip.user_id.trim()
      : opts.userId;

  const insertPayload: Record<string, unknown> = {
    user_id: ownerId,
    title: tripTitle,
    trip_id: tripId,
  };

  let { data: created, error: createError } = await supabase
    .from("conversations")
    .insert(insertPayload)
    .select("id, user_id, title, trip_id, created_at, updated_at")
    .single();

  // Migration not applied yet — create without trip_id, still link via trips.conversation_id
  if (createError && /trip_id|schema cache|PGRST|column/i.test(createError.message)) {
    const fallback = await supabase
      .from("conversations")
      .insert({ user_id: opts.userId, title: tripTitle })
      .select("id, user_id, title, created_at, updated_at")
      .single();
    created = fallback.data
      ? ({ ...fallback.data, trip_id: null } as typeof created)
      : null;
    createError = fallback.error;
  }

  if (createError || !created) {
    return {
      ok: false,
      error: createError?.message || "Failed to create trip conversation",
      status: 500,
    };
  }

  await supabase.from("trips").update({ conversation_id: created.id }).eq("id", tripId);

  return {
    ok: true,
    conversation: asConversation({ ...created, trip_id: tripId }),
    created: true,
  };
}

/** Load messages for a conversation (history-preserving). */
export async function loadConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("id, conversation_id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return { messages: [], error: error.message };
  return { messages: data ?? [], error: null };
}
