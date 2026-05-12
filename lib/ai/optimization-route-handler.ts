import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { runOptimizationForDay, undoItineraryRevision } from "@/lib/ai/optimization-service";
import type { OptimizationScenario } from "@/lib/ai/itinerary-optimization-engine";

export async function handleOptimizationRequest(input: {
  request: Request;
  params: Promise<{ id: string }>;
  scenario: OptimizationScenario;
}) {
  const { id: tripId } = await input.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = (await input.request.json().catch(() => ({}))) as Record<string, unknown>;
  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!date) return NextResponse.json({ ok: false, error: "Missing date." }, { status: 400 });

  try {
    const result = await runOptimizationForDay({
      supabase,
      tripId,
      userId: user.id,
      date,
      context: {
        scenario: input.scenario,
        nowIso: typeof body.nowIso === "string" ? body.nowIso : new Date().toISOString(),
        fatigueLevel:
          body.fatigueLevel === "low" || body.fatigueLevel === "medium" || body.fatigueLevel === "high"
            ? body.fatigueLevel
            : undefined,
        weatherSummary: typeof body.weatherSummary === "string" ? body.weatherSummary : undefined,
        mood:
          body.mood === "calm" ||
          body.mood === "adventure" ||
          body.mood === "culture" ||
          body.mood === "food" ||
          body.mood === "mixed" ||
          body.mood === "relax" ||
          body.mood === "explore" ||
          body.mood === "foodie" ||
          body.mood === "nightlife" ||
          body.mood === "romantic"
            ? body.mood
            : undefined,
        skipActivityId: typeof body.skipActivityId === "string" ? body.skipActivityId : undefined,
        delayMinutes: typeof body.delayMinutes === "number" ? body.delayMinutes : undefined,
        transportMode:
          body.transportMode === "walking" ||
          body.transportMode === "public_transport" ||
          body.transportMode === "ride_hailing" ||
          body.transportMode === "mixed" ||
          body.transportMode === "unknown"
            ? body.transportMode
            : undefined,
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not optimize itinerary.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function handleUndoRevisionRequest(input: {
  request: Request;
  params: Promise<{ id: string }>;
}) {
  const { id: tripId } = await input.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = (await input.request.json().catch(() => ({}))) as Record<string, unknown>;
  const revisionId = typeof body.revisionId === "string" ? body.revisionId.trim() : "";
  if (!revisionId) {
    return NextResponse.json({ ok: false, error: "Missing revisionId." }, { status: 400 });
  }

  try {
    const result = await undoItineraryRevision({
      supabase,
      tripId,
      userId: user.id,
      revisionId,
    });
    if (!result.restored) {
      return NextResponse.json(
        { ok: false, error: "Revision not found or cannot be restored." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not undo revision.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
