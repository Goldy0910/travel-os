import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  applyItineraryRefinement,
  previewItineraryRefinement,
  type ItineraryRefinementPatch,
} from "@/lib/itinerary-refinement";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = body.mode === "apply" ? "apply" : "preview";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const quickActionId =
    typeof body.quickActionId === "string" ? body.quickActionId.trim() : undefined;
  const destination =
    typeof body.destination === "string" ? body.destination.trim() : "your trip";

  if (!message && !quickActionId) {
    return NextResponse.json(
      { ok: false, error: "Provide a message or quick action." },
      { status: 400 },
    );
  }

  try {
    if (mode === "preview") {
      const preview = await previewItineraryRefinement({
        supabase,
        tripId,
        destination,
        message: message || quickActionId || "",
        quickActionId,
      });
      return NextResponse.json({
        ok: true,
        mode: "preview",
        patch: preview.patch,
        changes: preview.changes,
        source: preview.source,
      });
    }

    const patch = body.patch as ItineraryRefinementPatch | undefined;
    if (!patch || !Array.isArray(patch.ops)) {
      return NextResponse.json({ ok: false, error: "Missing patch." }, { status: 400 });
    }

    const result = await applyItineraryRefinement({
      supabase,
      tripId,
      userId: user.id,
      patch,
    });

    revalidatePath(`/app/trip/${tripId}`);
    revalidatePath(`/app/trip/${tripId}/activity`, "layout");
    revalidatePath("/app/home");

    return NextResponse.json({
      ok: true,
      mode: "apply",
      revisionId: result.revisionId,
      appliedOps: result.appliedOps,
      skippedOps: result.skippedOps,
      patch: result.patch,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not refine itinerary.";
    return NextResponse.json({ ok: false, error: msg }, { status: 422 });
  }
}
