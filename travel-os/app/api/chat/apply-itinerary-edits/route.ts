import "@/lib/tools";
import { executeTool } from "@/lib/tools/execute";
import type { ApplyItineraryEditsOutput } from "@/lib/tools/definitions/apply-itinerary-edits";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

type Body = {
  tripId?: unknown;
  proposalId?: unknown;
  intent?: unknown;
  summary?: unknown;
  edits?: unknown;
};

/**
 * User-confirmed apply path for itinerary edit proposals from chat / assistant UI.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const tripId = typeof body.tripId === "string" ? body.tripId.trim() : "";
  if (!tripId) {
    return Response.json({ ok: false, error: "tripId is required" }, { status: 400 });
  }

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  if (!Array.isArray(body.edits) || body.edits.length === 0) {
    return Response.json(
      { ok: false, error: "edits are required" },
      { status: 400 },
    );
  }

  const result = await executeTool({
    name: "apply_itinerary_edits",
    args: {
      tripId,
      proposalId:
        typeof body.proposalId === "string" ? body.proposalId.trim() : undefined,
      intent: typeof body.intent === "string" ? body.intent : undefined,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      edits: body.edits,
    },
    ctx: { userId: user.id, tripId },
  });

  if (!result.ok) {
    const status =
      result.code === "UNAUTHORIZED"
        ? 403
        : result.code === "INVALID_INPUT"
          ? 400
          : 500;
    return Response.json(
      { ok: false, error: result.error, code: result.code },
      { status },
    );
  }

  const data = result.data as ApplyItineraryEditsOutput;
  return Response.json({
    ok: true,
    ...data,
  });
}
