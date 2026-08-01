import type { Conversation } from "@/lib/chat/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

function parseOffset(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * GET /api/chat/conversations?q=&limit=&offset=
 * Paginated conversation list with optional title search.
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const offset = parseOffset(req.nextUrl.searchParams.get("offset"));

  let query = supabase
    .from("conversations")
    .select("id, user_id, title, created_at, updated_at, trip_id", { count: "exact" })
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Standalone inbox only — trip conversations are accessed via the trip Chat tab.
  query = query.is("trip_id", null);

  if (q) {
    // Escape LIKE wildcards in user input
    const escaped = q.replace(/[%_]/g, (ch) => `\\${ch}`);
    query = query.ilike("title", `%${escaped}%`);
  }

  let { data, error, count } = await query;
  if (error && /trip_id|schema cache|PGRST|column/i.test(error.message)) {
    let fallback = supabase
      .from("conversations")
      .select("id, user_id, title, created_at, updated_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (q) {
      const escaped = q.replace(/[%_]/g, (ch) => `\\${ch}`);
      fallback = fallback.ilike("title", `%${escaped}%`);
    }
    const result = await fallback;
    data = result.data as typeof data;
    error = result.error;
    count = result.count;
  }
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const conversations = (data ?? []) as Conversation[];
  const total = typeof count === "number" ? count : conversations.length;
  const nextOffset = offset + conversations.length;
  const hasMore = nextOffset < total;

  return Response.json({
    ok: true,
    conversations,
    pagination: {
      limit,
      offset,
      nextOffset,
      total,
      hasMore,
    },
  });
}
