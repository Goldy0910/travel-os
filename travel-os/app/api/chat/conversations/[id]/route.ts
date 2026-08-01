import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/chat/conversations/[id] — rename conversation
 * DELETE /api/chat/conversations/[id] — delete conversation (+ cascaded messages)
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const conversationId = id?.trim();
  if (!conversationId) {
    return Response.json({ ok: false, error: "Missing conversation id" }, { status: 400 });
  }

  let body: { title?: unknown };
  try {
    body = (await req.json()) as { title?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return Response.json({ ok: false, error: "Title is required" }, { status: 400 });
  }
  if (title.length > 80) {
    return Response.json({ ok: false, error: "Title is too long" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .update({ title })
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .select("id, user_id, title, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  return Response.json({ ok: true, conversation: data });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const conversationId = id?.trim();
  if (!conversationId) {
    return Response.json({ ok: false, error: "Missing conversation id" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select("id, trip_id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError && !/trip_id|schema cache|PGRST|column/i.test(existingError.message)) {
    return Response.json({ ok: false, error: existingError.message }, { status: 500 });
  }

  if (
    existing &&
    typeof existing.trip_id === "string" &&
    existing.trip_id.trim()
  ) {
    return Response.json(
      {
        ok: false,
        error: "Trip conversations cannot be deleted from standalone chat",
        tripId: existing.trip_id,
      },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  return Response.json({ ok: true, id: data.id });
}
